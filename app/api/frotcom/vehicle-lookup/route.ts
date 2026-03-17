import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { lookupVehicleAt } from '@/lib/frotcom'

// GET /api/frotcom/vehicle-lookup?truckId=123&at=2026-03-15T10:30:00Z
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const truckId = Number(searchParams.get('truckId'))
  const atParam = searchParams.get('at')

  if (!truckId || !atParam) {
    return NextResponse.json({ error: 'truckId and at are required' }, { status: 400 })
  }

  const at = new Date(atParam)
  if (isNaN(at.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  const truck = await prisma.truck.findUnique({
    where: { id: truckId },
    select: { frotcomVehicleId: true, useCanbusMileage: true },
  })

  if (!truck) {
    return NextResponse.json({ error: 'Truck not found' }, { status: 404 })
  }

  if (!truck.frotcomVehicleId) {
    return NextResponse.json({ driverName: null, driverId: null, mileage: null })
  }

  try {
    const result = await lookupVehicleAt(truck.frotcomVehicleId, at, truck.useCanbusMileage)

    // Resolve driver record from frotcomDriverId
    let driverRecord: { id: number; name: string } | null = null
    if (result.driverId) {
      driverRecord = await prisma.driver.findUnique({
        where: { frotcomDriverId: result.driverId },
        select: { id: true, name: true },
      })
    }

    return NextResponse.json({
      driverName: driverRecord?.name ?? result.driverName,
      driverId: driverRecord?.id ?? null,
      mileage: result.mileage,
    })
  } catch (err) {
    console.warn('[vehicle-lookup] Frotcom lookup failed:', err)
    return NextResponse.json({ driverName: null, driverId: null, mileage: null })
  }
}
