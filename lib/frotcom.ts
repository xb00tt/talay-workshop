import { prisma } from './prisma'

const BASE = 'https://v2api.frotcom.com/v2'

type Settings = { frotcomUsername: string | null; frotcomPassword: string | null }

// ─── Auth ──────────────────────────────────────────────────────────────────────

// Accepts already-loaded settings to avoid a second DB read when called from getToken.
async function reauth(settings?: Settings | null): Promise<string> {
  const s = settings !== undefined ? settings : await prisma.settings.findUnique({ where: { id: 1 } })
  if (!s?.frotcomUsername || !s?.frotcomPassword) {
    throw new Error('Frotcom auth failed: credentials not configured in Settings')
  }
  const res = await fetch(`${BASE}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'thirdparty',
      username: s.frotcomUsername,
      password: s.frotcomPassword,
    }),
  })
  if (!res.ok) throw new Error(`Frotcom auth failed: ${res.status}`)
  const json = await res.json()
  // Swagger spec: POST /v2/authorize returns { token: "..." }
  const token: string = json.token ?? ''
  if (!token) throw new Error('Frotcom auth: no token in response')
  await prisma.settings.update({ where: { id: 1 }, data: { frotcomToken: token } })
  return token
}

async function getToken(): Promise<string> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } })
  if (settings?.frotcomToken) return settings.frotcomToken
  // Pass already-loaded settings to reauth to avoid a second DB read
  return reauth(settings)
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildUrl(path: string, token: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${BASE}${path}${sep}api_key=${token}`
}

function throw429(res: Response): never {
  const endpointRemaining = res.headers.get('X-Endpoint-RateLimit-Remaining')
  const limitType = endpointRemaining === '0' ? 'endpoint' : 'company'
  const resetHeader = limitType === 'endpoint'
    ? res.headers.get('X-Endpoint-RateLimit-Reset')
    : res.headers.get('X-RateLimit-Reset')
  const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000).toISOString() : 'unknown'
  throw new Error(`Frotcom rate limit exceeded (${limitType} limit). Resets at ${resetAt}.`)
}

// ─── GET with automatic 401 retry and 429 handling ────────────────────────────

export async function frotcomGet<T>(path: string): Promise<T> {
  const token = await getToken()
  const signal = AbortSignal.timeout(5000)
  let res = await fetch(buildUrl(path, token), { signal })

  if (res.status === 401) {
    const newToken = await reauth()
    res = await fetch(buildUrl(path, newToken), { signal })
  }

  if (res.status === 429) throw429(res)
  if (!res.ok) throw new Error(`Frotcom GET ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

// ─── Mileage sync ─────────────────────────────────────────────────────────────

type FrotcomVehicle = {
  id: string | number
  odometerCanbus: number | null
  odometerGps: number | null
  useCanbusMileage?: boolean
}

// Syncs current mileage for all Frotcom-linked trucks.
// Returns { updated: number, errors: string[] }
export async function syncFrotcomMileage(): Promise<{ updated: number; errors: string[] }> {
  const trucks = await prisma.truck.findMany({
    where:  { frotcomVehicleId: { not: null }, isActive: true },
    select: { id: true, frotcomVehicleId: true, useCanbusMileage: true },
  })

  if (trucks.length === 0) return { updated: 0, errors: [] }

  // One call gets all vehicles with live odometer data
  const raw = await frotcomGet<unknown>('/vehicles')

  if (!Array.isArray(raw)) {
    throw new Error(
      `Frotcom GET /vehicles returned unexpected shape: ${JSON.stringify(raw).slice(0, 200)}`
    )
  }

  const vehicles = raw as FrotcomVehicle[]
  // Stringify both sides to guard against string/number id mismatch
  const vehicleMap = new Map(vehicles.map((v) => [String(v.id), v]))

  const errors: string[] = []

  const updates = trucks.flatMap((truck) => {
    const vehicle = vehicleMap.get(String(truck.frotcomVehicleId))
    if (!vehicle) {
      errors.push(`Vehicle ${truck.frotcomVehicleId} not found in Frotcom response`)
      return []
    }

    const mileage = truck.useCanbusMileage
      ? (vehicle.odometerCanbus ?? vehicle.odometerGps)
      : (vehicle.odometerGps   ?? vehicle.odometerCanbus)

    if (mileage == null) {
      errors.push(`No mileage data for vehicle ${truck.frotcomVehicleId}`)
      return []
    }

    return [prisma.truck.update({ where: { id: truck.id }, data: { currentMileage: mileage } })]
  })

  await Promise.all(updates)

  return { updated: updates.length, errors }
}

// ─── Vehicle lookup at a point in time ───────────────────────────────────────

type FrotcomLocation = {
  timeStamp: string
  driverId: number | null
  driverName: string | null
  odometerCanbus: number | null
  odometerGps: number | null
}

/**
 * GET /v2/vehicles/{id}/locations?df=<start>&dt=<end>
 *
 * Returns an array of VehicleLocation records for the given period.
 * Each record includes driverId, driverName, odometerCanbus, odometerGps.
 * We query a ±1h window around `at` and pick the record closest in time.
 */
export async function lookupVehicleAt(
  frotcomVehicleId: string,
  at: Date,
  useCanbusMileage: boolean,
): Promise<{ driverName: string | null; driverId: string | null; mileage: number | null }> {
  const windowMs = 60 * 60 * 1000 // 1 hour
  const df = new Date(at.getTime() - windowMs).toISOString()
  const dt = new Date(at.getTime() + windowMs).toISOString()

  const locations = await frotcomGet<FrotcomLocation[]>(
    `/vehicles/${frotcomVehicleId}/locations?df=${encodeURIComponent(df)}&dt=${encodeURIComponent(dt)}`,
  )

  if (!Array.isArray(locations) || locations.length === 0) {
    return { driverName: null, driverId: null, mileage: null }
  }

  // Find the location record closest to the requested time
  const atMs = at.getTime()
  let best = locations[0]
  let bestDiff = Math.abs(new Date(best.timeStamp).getTime() - atMs)
  for (const loc of locations) {
    const diff = Math.abs(new Date(loc.timeStamp).getTime() - atMs)
    if (diff < bestDiff) { best = loc; bestDiff = diff }
  }

  const driverName = best.driverName ? cleanDriverName(best.driverName) : null
  const driverId   = best.driverId != null ? String(best.driverId) : null

  const mileage = useCanbusMileage
    ? (best.odometerCanbus ?? best.odometerGps ?? null)
    : (best.odometerGps    ?? best.odometerCanbus ?? null)

  return { driverName, driverId, mileage }
}

// ─── Driver name validation ────────────────────────────────────────────────────

export function cleanDriverName(raw: string): string | null {
  const name = raw.replace(/^\*+/, '').trim()
  if (!name) return null
  if (/^\d/.test(name)) return null               // starts with digit → junk
  if (/created by/i.test(name)) return null        // card-generated → junk
  return name
}
