import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [activeServices, upcomingServices, allActiveTruckIds, trucksForAlerts] =
    await Promise.all([
      prisma.serviceOrder.findMany({
        where: { status: { in: ['INTAKE', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY'] } },
        include: { truck: { select: { make: true, model: true } } },
        orderBy: { startDate: 'asc' },
      }),

      prisma.serviceOrder.findMany({
        where:   { status: 'SCHEDULED' },
        orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
        take:    10,
        include: { truck: { select: { make: true, model: true } } },
      }),

      prisma.serviceOrder.findMany({
        where:  { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        select: { truckId: true },
      }),

      prisma.truck.findMany({
        where:   { isActive: true, currentMileage: { not: null } },
        include: {
          serviceOrders: {
            where:   { status: 'COMPLETED', mileageAtService: { not: null } },
            orderBy: { createdAt: 'desc' },
            take:    1,
          },
        },
      }),
    ])

  const activeTruckIdSet = new Set(allActiveTruckIds.map((s) => s.truckId))

  const mileageAlerts = trucksForAlerts
    .filter((truck) => {
      if (activeTruckIdSet.has(truck.id)) return false
      const lastService = truck.serviceOrders[0]
      const kmSince = lastService
        ? truck.currentMileage! - lastService.mileageAtService!
        : truck.lastKnownServiceMileage != null
          ? truck.currentMileage! - truck.lastKnownServiceMileage
          : null
      return kmSince != null && kmSince >= truck.mileageTriggerKm
    })
    .map((t) => ({
      id:                 t.id,
      plateNumber:        t.plateNumber,
      make:               t.make,
      model:              t.model,
      currentMileage:     t.currentMileage!,
      mileageTriggerKm:   t.mileageTriggerKm,
      lastServiceMileage: t.serviceOrders[0]?.mileageAtService ?? t.lastKnownServiceMileage ?? null,
    }))

  const activeServicesMapped = activeServices.map((s) => ({
    id:                 s.id,
    truckPlateSnapshot: s.truckPlateSnapshot,
    truckMake:          s.truck.make,
    truckModel:         s.truck.model,
    status:             s.status,
    startDate:          s.startDate?.toISOString() ?? null,
    createdAt:          s.createdAt.toISOString(),
  }))

  const upcoming = upcomingServices.map((s) => ({
    id:                 s.id,
    truckPlateSnapshot: s.truckPlateSnapshot,
    truckMake:          s.truck.make,
    truckModel:         s.truck.model,
    scheduledDate:      s.scheduledDate.toISOString(),
  }))

  return NextResponse.json({ activeServices: activeServicesMapped, upcoming, mileageAlerts })
}
