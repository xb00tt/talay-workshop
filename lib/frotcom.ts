import { prisma } from './prisma'

const BASE = 'https://v2api.frotcom.com/v2'

// ─── Auth ──────────────────────────────────────────────────────────────────────

async function reauth(): Promise<string> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } })
  const res = await fetch(`${BASE}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'thirdparty',
      username: settings?.frotcomUsername ?? '',
      password: settings?.frotcomPassword ?? '',
    }),
  })
  if (!res.ok) throw new Error(`Frotcom auth failed: ${res.status}`)
  const json = await res.json()
  // Frotcom returns { api_key: "..." }
  const token: string = json.api_key ?? json.token ?? ''
  if (!token) throw new Error('Frotcom auth: no token in response')
  await prisma.settings.update({ where: { id: 1 }, data: { frotcomToken: token } })
  return token
}

async function getToken(): Promise<string> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } })
  if (settings?.frotcomToken) return settings.frotcomToken
  return reauth()
}

// ─── GET with automatic 401 retry ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function frotcomGet(path: string): Promise<any> {
  const token = await getToken()
  let res = await fetch(`${BASE}${path}?api_key=${token}`)
  if (res.status === 401) {
    const newToken = await reauth()
    res = await fetch(`${BASE}${path}?api_key=${newToken}`)
  }
  if (!res.ok) throw new Error(`Frotcom GET ${path} failed: ${res.status}`)
  return res.json()
}

// ─── Mileage sync ─────────────────────────────────────────────────────────────

// Syncs current mileage for all Frotcom-linked trucks.
// Returns { updated: number, errors: string[] }
export async function syncFrotcomMileage(): Promise<{ updated: number; errors: string[] }> {
  const trucks = await prisma.truck.findMany({
    where:  { frotcomVehicleId: { not: null }, isActive: true },
    select: { id: true, frotcomVehicleId: true, useCanbusMileage: true },
  })

  if (trucks.length === 0) return { updated: 0, errors: [] }

  // One call gets all vehicles with live odometer data
  const vehicles = await frotcomGet('/vehicles') as {
    id: string; odometerCanbus: number | null; odometerGps: number | null; useCanbusMileage?: boolean
  }[]

  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]))

  let updated = 0
  const errors: string[] = []

  for (const truck of trucks) {
    const vehicle = vehicleMap.get(truck.frotcomVehicleId!)
    if (!vehicle) { errors.push(`Vehicle ${truck.frotcomVehicleId} not found in Frotcom response`); continue }

    const mileage = truck.useCanbusMileage
      ? (vehicle.odometerCanbus ?? vehicle.odometerGps)
      : (vehicle.odometerGps   ?? vehicle.odometerCanbus)

    if (mileage == null) { errors.push(`No mileage data for vehicle ${truck.frotcomVehicleId}`); continue }

    await prisma.truck.update({ where: { id: truck.id }, data: { currentMileage: mileage } })
    updated++
  }

  return { updated, errors }
}

// ─── Driver name validation ────────────────────────────────────────────────────

export function cleanDriverName(raw: string): string | null {
  const name = raw.replace(/^\*+/, '').trim()
  if (!name) return null
  if (/^\d/.test(name)) return null               // starts with digit → junk
  if (/created by/i.test(name)) return null        // card-generated → junk
  return name
}
