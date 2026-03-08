import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { frotcomGet, cleanDriverName } from '@/lib/frotcom'
import { logAudit, auditActor } from '@/lib/audit'

// POST /api/trucks/import — import trucks from Frotcom
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'truck.import')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let vehicles: FrotcomVehicle[]
  try {
    vehicles = await frotcomGet('/vehicles')
  } catch (e) {
    return NextResponse.json({ error: `Frotcom грешка: ${(e as Error).message}` }, { status: 502 })
  }

  // Load existing Frotcom IDs to skip duplicates
  const existing = await prisma.truck.findMany({
    where: { frotcomVehicleId: { not: null } },
    select: { frotcomVehicleId: true },
  })
  const existingIds = new Set(existing.map((t) => t.frotcomVehicleId as string))

  let imported = 0
  let skipped  = 0
  const errors: string[] = []

  for (const v of vehicles) {
    const fid = String(v.id)
    if (existingIds.has(fid)) { skipped++; continue }

    // Fetch detail for modelYear (only for new trucks)
    let modelYear: number | null = null
    try {
      const detail: FrotcomVehicleDetail = await frotcomGet(`/vehicles/${v.id}`)
      modelYear = detail.modelYear ?? null
    } catch {
      // modelYear stays null — acceptable
    }

    const mileage = v.useCanbusMileage ? (v.odometerCanbus ?? null) : (v.odometerGps ?? null)

    try {
      await prisma.truck.create({
        data: {
          plateNumber:      (v.licensePlate ?? '').trim().toUpperCase(),
          make:             (v.manufacturer ?? '').trim(),
          model:            (v.model ?? '').trim(),
          year:             modelYear,
          frotcomVehicleId: fid,
          currentMileage:   mileage,
          useCanbusMileage: v.useCanbusMileage ?? true,
          mileageTriggerKm: 30000,
          isAdr:            false,
        },
      })
      imported++
    } catch (e) {
      errors.push(`${v.licensePlate}: ${(e as Error).message}`)
      continue
    }

    // Handle driver
    if (v.driverId && v.driverName) {
      const cleanName = cleanDriverName(v.driverName)
      if (cleanName) {
        const driverFid = String(v.driverId)
        const existing  = await prisma.driver.findUnique({ where: { frotcomDriverId: driverFid } })
        if (!existing) {
          await prisma.driver.create({
            data: { name: cleanName, frotcomDriverId: driverFid },
          })
        }
      }
    }
  }

  await logAudit({
    ...auditActor(session),
    action:     'truck.import',
    entityType: 'Truck',
    entityId:   'bulk',
    newValue:   { imported, skipped },
  })

  return NextResponse.json({ imported, skipped, errors })
}

// ─── Frotcom vehicle shape ─────────────────────────────────────────────────────

interface FrotcomVehicle {
  id:               number | string
  licensePlate:     string
  manufacturer:     string
  model:            string
  odometerCanbus:   number | null
  odometerGps:      number | null
  useCanbusMileage: boolean
  driverId:         number | string | null
  driverName:       string | null
}

interface FrotcomVehicleDetail {
  modelYear?: number | null
}
