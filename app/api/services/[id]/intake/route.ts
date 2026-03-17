import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { logAudit, auditActor } from '@/lib/audit'
import { SERVICE_FULL_INCLUDE } from '@/lib/service-includes'

type Params = { params: Promise<{ id: string }> }

// POST /api/services/[id]/intake
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'service.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const serviceId = Number(id)

  const service = await prisma.serviceOrder.findUnique({ where: { id: serviceId } })
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (service.status !== 'SCHEDULED') {
    return NextResponse.json({ error: 'Само планирани поръчки могат да бъдат приети.' }, { status: 422 })
  }

  const body = await request.json()
  const entryAt          = body.entryAt ? new Date(body.entryAt) : new Date()
  const driverId         = body.driverId ? Number(body.driverId) : null
  const driverName       = body.driverName ?? null
  const mileageAtService = body.mileageAtService != null ? Number(body.mileageAtService) : null

  // If mileage provided, update the truck's current mileage too
  if (mileageAtService != null) {
    await prisma.truck.update({ where: { id: service.truckId }, data: { currentMileage: mileageAtService } })
  }

  // Resolve driver record if driverId provided
  let driverRecord: { id: number; name: string } | null = null
  if (driverId) {
    driverRecord = await prisma.driver.findUnique({ where: { id: driverId } })
  }

  // Snapshot driver name: prefer DB record name, fallback to provided driverName
  const snapshotName = driverRecord?.name ?? driverName ?? null

  const templateItems = await prisma.checklistTemplate.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  })

  const updated = await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.update({
      where: { id: serviceId },
      data: {
        status:             'INTAKE',
        driverId:           driverRecord?.id ?? null,
        driverNameSnapshot: snapshotName,
        startDate:          entryAt,
        mileageAtService:   mileageAtService,
      },
    })

    const checklistSection = await tx.serviceSection.create({
      data: { serviceOrderId: serviceId, type: 'CHECKLIST', title: 'Контролен списък', order: 1 },
    })

    if (templateItems.length > 0) {
      await tx.serviceChecklistItem.createMany({
        data: templateItems.map((item) => ({
          serviceSectionId: checklistSection.id,
          description:      item.description,
        })),
      })
    }

    await tx.serviceSection.create({
      data: { serviceOrderId: serviceId, type: 'EQUIPMENT_CHECK', title: 'Проверка на оборудване', order: 2 },
    })

    await tx.serviceSection.create({
      data: { serviceOrderId: serviceId, type: 'DRIVER_FEEDBACK', title: 'Обратна връзка от шофьора', order: 3 },
    })

    return tx.serviceOrder.findUnique({
      where: { id: serviceId },
      include: SERVICE_FULL_INCLUDE,
    })
  })

  await logAudit({
    ...auditActor(session),
    action:     'service.intake',
    entityType: 'ServiceOrder',
    entityId:   serviceId,
    newValue:   { entryAt: entryAt.toISOString(), driverName: snapshotName, mileageAtService },
  })

  return NextResponse.json({ service: updated })
}
