import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const [bays, activeServices, upcomingServices, allActiveTruckIds, trucksForAlerts] =
    await Promise.all([
      prisma.bay.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),

      prisma.serviceOrder.findMany({
        where: { status: { in: ['INTAKE', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY'] } },
        include: {
          truck: { select: { make: true, model: true } },
        },
      }),

      prisma.serviceOrder.findMany({
        where: { status: 'SCHEDULED' },
        orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
        take: 10,
        include: { truck: { select: { make: true, model: true } } },
      }),

      // Used to exclude trucks already in workshop from mileage alerts
      prisma.serviceOrder.findMany({
        where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        select: { truckId: true },
      }),

      prisma.truck.findMany({
        where: { isActive: true, currentMileage: { not: null } },
        include: {
          serviceOrders: {
            where: { status: 'COMPLETED', mileageAtService: { not: null } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ])

  // Trucks with any open service — excluded from mileage alerts
  const activeTruckIdSet = new Set(allActiveTruckIds.map((s) => s.truckId))

  const mileageAlerts = trucksForAlerts
    .filter((truck) => {
      if (activeTruckIdSet.has(truck.id)) return false
      const lastService = truck.serviceOrders[0]
      const kmSince = lastService
        ? truck.currentMileage! - lastService.mileageAtService!
        : truck.currentMileage!
      return kmSince >= truck.mileageTriggerKm
    })
    .map((t) => ({
      id:                 t.id,
      plateNumber:        t.plateNumber,
      make:               t.make,
      model:              t.model,
      currentMileage:     t.currentMileage!,
      mileageTriggerKm:   t.mileageTriggerKm,
      lastServiceMileage: t.serviceOrders[0]?.mileageAtService ?? null,
    }))

  // Build bay → service map
  const bayServiceMap = new Map(
    activeServices.filter((s) => s.bayId !== null).map((s) => [s.bayId!, s]),
  )

  const baysWithService = bays.map((b) => {
    const svc = bayServiceMap.get(b.id)
    return {
      id:   b.id,
      name: b.name,
      service: svc
        ? {
            id:                 svc.id,
            truckPlateSnapshot: svc.truckPlateSnapshot,
            truckMake:          svc.truck.make,
            truckModel:         svc.truck.model,
            status:             svc.status as 'INTAKE' | 'IN_PROGRESS' | 'QUALITY_CHECK' | 'READY',
            startDate:          svc.startDate?.toISOString() ?? null,
            createdAt:          svc.createdAt.toISOString(),
          }
        : null,
    }
  })

  const unbayedServices = activeServices
    .filter((s) => s.bayId === null)
    .map((s) => ({
      id:                 s.id,
      truckPlateSnapshot: s.truckPlateSnapshot,
      truckMake:          s.truck.make,
      truckModel:         s.truck.model,
      status:             s.status,
      startDate:          s.startDate?.toISOString() ?? null,
      createdAt:          s.createdAt.toISOString(),
    }))

  return (
    <DashboardClient
      bays={baysWithService}
      upcoming={upcomingServices.map((s) => ({
        id:                 s.id,
        truckPlateSnapshot: s.truckPlateSnapshot,
        truckMake:          s.truck.make,
        truckModel:         s.truck.model,
        scheduledDate:      s.scheduledDate.toISOString(),
      }))}
      mileageAlerts={mileageAlerts}
      unbayedServices={unbayedServices}
    />
  )
}
