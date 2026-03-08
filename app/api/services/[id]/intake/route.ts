import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { frotcomGet } from '@/lib/frotcom'
import { logAudit, auditActor } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

// POST /api/services/[id]/intake
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const serviceId = Number(id)

  const service = await prisma.serviceOrder.findUnique({ where: { id: serviceId } })
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (service.status !== 'SCHEDULED') {
    return NextResponse.json({ error: 'Само планирани поръчки могат да бъдат приети.' }, { status: 422 })
  }

  const body = await request.json()
  const { bayId, driverId, mileageAtService } = body

  if (!bayId) return NextResponse.json({ error: 'Изберете бокс.' }, { status: 422 })

  const bay = await prisma.bay.findUnique({ where: { id: Number(bayId) } })
  if (!bay || !bay.isActive) return NextResponse.json({ error: 'Боксът не е намерен.' }, { status: 404 })

  // Hard block: bay already occupied
  const occupying = await prisma.serviceOrder.findFirst({
    where: {
      bayId:  bay.id,
      status: { in: ['INTAKE', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY'] },
      id:     { not: serviceId },
    },
  })
  if (occupying) {
    return NextResponse.json({ error: 'Боксът е зает от друга поръчка.' }, { status: 409 })
  }

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
      } catch { /* Frotcom unavailable — proceed without mileage */ }
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
        bayId:              bay.id,
        bayNameSnapshot:    bay.name,
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

    return tx.serviceOrder.findUnique({
      where: { id: serviceId },
      include: {
        truck:    { select: { id: true, make: true, model: true, year: true, isAdr: true, frotcomVehicleId: true } },
        bay:      { select: { id: true, name: true } },
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
    newValue:   { bayId: bay.id, bayName: bay.name, driverName: driverRecord?.name ?? null, mileageAtService: resolvedMileage },
  })

  return NextResponse.json({ service: updated })
}
