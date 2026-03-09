import { prisma } from '@/lib/prisma'

export type EnrichedTruck = {
  id: number
  plateNumber: string
  make: string
  model: string
  year: number | null
  frotcomVehicleId: string | null
  currentMileage: number | null
  mileageTriggerKm: number
  isAdr: boolean
  isActive: boolean
  lastServiceDate: string | null
  lastServiceMileage: number | null
  kmSinceService: number | null
  mileageAlert: boolean
  activeService: { id: number; status: string } | null
}

export async function enrichTrucks(
  trucks: {
    id: number; plateNumber: string; make: string; model: string; year: number | null
    frotcomVehicleId: string | null; currentMileage: number | null; mileageTriggerKm: number
    isAdr: boolean; isActive: boolean
  }[]
): Promise<EnrichedTruck[]> {
  if (trucks.length === 0) return []

  const ids = trucks.map((t) => t.id)

  const [lastCompleted, activeServices] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: { status: 'COMPLETED', truckId: { in: ids } },
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
      select: { truckId: true, endDate: true, scheduledDate: true, mileageAtService: true },
    }),
    prisma.serviceOrder.findMany({
      where: { status: { notIn: ['COMPLETED', 'CANCELLED'] }, truckId: { in: ids } },
      select: { id: true, truckId: true, status: true },
    }),
  ])

  // Most recent completed per truck (already ordered desc, take first occurrence)
  const lastMap = new Map<number, { endDate: Date | null; scheduledDate: Date; mileageAtService: number | null }>()
  for (const s of lastCompleted) {
    if (!lastMap.has(s.truckId)) lastMap.set(s.truckId, s)
  }

  const activeMap = new Map<number, { id: number; status: string }>()
  for (const s of activeServices) activeMap.set(s.truckId, s)

  return trucks.map((t) => {
    const last = lastMap.get(t.id) ?? null
    const active = activeMap.get(t.id) ?? null
    const lastMileage = last?.mileageAtService ?? null
    const kmSince = t.currentMileage != null && lastMileage != null ? t.currentMileage - lastMileage : null
    const mileageAlert = kmSince != null && kmSince >= t.mileageTriggerKm
    const lastDate = last ? (last.endDate ?? last.scheduledDate) : null
    return {
      ...t,
      lastServiceDate: lastDate ? new Date(lastDate).toISOString() : null,
      lastServiceMileage: lastMileage,
      kmSinceService: kmSince,
      mileageAlert,
      activeService: active,
    }
  })
}
