import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { SERVICE_FULL_INCLUDE } from '@/lib/service-includes'
import ServiceOrderClient from './ServiceOrderClient'

export default async function ServiceOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { id } = await params
  const serviceId = Number(id)
  if (isNaN(serviceId)) notFound()

  const [service, mechanics, equipmentItems, adrEquipmentItems] = await Promise.all([
    prisma.serviceOrder.findUnique({
      where: { id: serviceId },
      include: SERVICE_FULL_INCLUDE,
    }),
    prisma.mechanic.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.equipmentItem.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
    prisma.adrEquipmentItem.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
  ])

  if (!service) notFound()

  // Compute km driven since last completed service + last equipment snapshot
  let tripSinceLastService: number | null = null
  const [prevService, lastSnapshot] = await Promise.all([
    service.mileageAtService != null
      ? prisma.serviceOrder.findFirst({
          where:   { truckId: service.truckId, status: 'COMPLETED', id: { not: serviceId } },
          orderBy: { endDate: 'desc' },
          select:  { mileageAtService: true },
        })
      : null,
    prisma.truckEquipmentSnapshot.findFirst({
      where:   { truckId: service.truckId, serviceOrderId: { not: serviceId } },
      orderBy: { createdAt: 'desc' },
      include: { items: { select: { itemName: true, status: true } } },
    }),
  ])
  if (prevService?.mileageAtService != null && service.mileageAtService != null) {
    tripSinceLastService = service.mileageAtService - prevService.mileageAtService
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
      lastSnapshot={lastSnapshot?.items ?? []}
    />
  )
}
