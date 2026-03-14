import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import ServiceOrderClient from './ServiceOrderClient'

export default async function ServiceOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { id } = await params
  const serviceId = Number(id)
  if (isNaN(serviceId)) notFound()

  const [service, drivers, mechanics, equipmentItems, adrEquipmentItems] = await Promise.all([
    prisma.serviceOrder.findUnique({
      where: { id: serviceId },
      include: {
        truck:    { select: { id: true, make: true, model: true, year: true, isAdr: true, frotcomVehicleId: true } },
        driver:   { select: { id: true, name: true } },
        sections: {
          orderBy: { order: 'asc' },
          include: {
            checklistItems: true,
            workCards: {
              include: {
                mechanic: { select: { id: true, name: true } },
                parts:    true,
                notes:    { orderBy: { createdAt: 'asc' } },
                photos:   true,
              },
            },
          },
        },
        equipmentCheckItems: true,
        driverFeedbackItems: { orderBy: { order: 'asc' } },
        notes:  { orderBy: { createdAt: 'asc' } },
        photos: true,
      },
    }),
    prisma.driver.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.mechanic.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.equipmentItem.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
    prisma.adrEquipmentItem.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
  ])

  if (!service) notFound()

  // Compute km driven since last completed service for this truck
  let tripSinceLastService: number | null = null
  if (service.mileageAtService != null) {
    const prevService = await prisma.serviceOrder.findFirst({
      where:   { truckId: service.truckId, status: 'COMPLETED', id: { not: serviceId } },
      orderBy: { endDate: 'desc' },
      select:  { mileageAtService: true },
    })
    if (prevService?.mileageAtService != null) {
      tripSinceLastService = service.mileageAtService - prevService.mileageAtService
    }
  }

  const { role, permissions } = session.user

  function ser(svc: NonNullable<typeof service>) {
    return {
      ...svc,
      scheduledDate: svc.scheduledDate.toISOString(),
      startDate:     svc.startDate?.toISOString() ?? null,
      endDate:       svc.endDate?.toISOString() ?? null,
      createdAt:     svc.createdAt.toISOString(),
      sections: svc.sections.map((sec) => ({
        ...sec,
        intakeSkippedAt: sec.intakeSkippedAt?.toISOString() ?? null,
        exitSkippedAt:   sec.exitSkippedAt?.toISOString() ?? null,
        checklistItems: sec.checklistItems.map((i) => ({
          ...i,
          completedAt: i.completedAt?.toISOString() ?? null,
        })),
        workCards: sec.workCards.map((wc) => ({
          ...wc,
          cancelledAt: wc.cancelledAt?.toISOString() ?? null,
          reopenedAt:  wc.reopenedAt?.toISOString() ?? null,
          notes:       wc.notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
          photos:      wc.photos.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
        })),
      })),
      equipmentCheckItems: svc.equipmentCheckItems,
      notes:  svc.notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
      photos: svc.photos.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    }
  }

  return (
    <ServiceOrderClient
      initialService={ser(service)}
      tripSinceLastService={tripSinceLastService}
      drivers={drivers}
      mechanics={mechanics}
      userName={session.user.name ?? ''}
      canReschedule={hasPermission(role, permissions, 'service.reschedule')}
      canCancel={hasPermission(role, permissions, 'service.cancel')}
      canCreateWorkCard={hasPermission(role, permissions, 'workcard.create')}
      canCancelWorkCard={hasPermission(role, permissions, 'workcard.cancel')}
      canReopenWorkCard={hasPermission(role, permissions, 'workcard.reopen')}
      canCompleteWorkCard={hasPermission(role, permissions, 'workcard.complete')}
      canCreateNote={hasPermission(role, permissions, 'note.create')}
      canUploadPhoto={hasPermission(role, permissions, 'photo.upload')}
      equipmentItems={equipmentItems}
      adrEquipmentItems={adrEquipmentItems}
    />
  )
}
