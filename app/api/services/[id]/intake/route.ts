import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { frotcomGet } from '@/lib/frotcom'
import { logAudit, auditActor } from '@/lib/audit'

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
  const { driverId, mileageAtService } = body

  let driverRecord: { id: number; name: string } | null = null
  if (driverId) {
    driverRecord = await prisma.driver.findUnique({ where: { id: Number(driverId) } })
    if (!driverRecord) return NextResponse.json({ error: 'Шофьорът не е намерен.' }, { status: 404 })
  }

  // Auto-pull mileage from Frotcom if truck is linked and no manual override provided
  let resolvedMileage: number | null = mileageAtService ? Number(mileageAtService) : null
  if (resolvedMileage === null) {
    const truck = await prisma.truck.findUnique({
      where:  { id: service.truckId },
      select: { frotcomVehicleId: true, useCanbusMileage: true },
    })
    if (truck?.frotcomVehicleId) {
      try {
        const vehicles = await frotcomGet('/vehicles') as {
          id: string; odometerCanbus: number | null; odometerGps: number | null
        }[]
        const v = vehicles.find((x) => x.id === truck.frotcomVehicleId)
        if (v) {
          resolvedMileage = truck.useCanbusMileage
            ? (v.odometerCanbus ?? v.odometerGps ?? null)
            : (v.odometerGps   ?? v.odometerCanbus ?? null)
          // Also update truck's currentMileage
          if (resolvedMileage !== null) {
            await prisma.truck.update({ where: { id: service.truckId }, data: { currentMileage: resolvedMileage } })
          }
        }
      } catch (err) { console.warn('[intake] Frotcom mileage sync failed:', err) }
    }
  }

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
        driverNameSnapshot: driverRecord?.name ?? null,
        startDate:          new Date(),
        mileageAtService:   resolvedMileage,
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
    })
  })

  await logAudit({
    ...auditActor(session),
    action:     'service.intake',
    entityType: 'ServiceOrder',
    entityId:   serviceId,
    newValue:   { driverName: driverRecord?.name ?? null, mileageAtService: resolvedMileage },
  })

  return NextResponse.json({ service: updated })
}
