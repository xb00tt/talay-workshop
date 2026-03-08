import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { logAudit, auditActor } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

// Allowed status transitions
const TRANSITIONS: Record<string, string> = {
  INTAKE:        'IN_PROGRESS',
  IN_PROGRESS:   'QUALITY_CHECK',
  QUALITY_CHECK: 'READY',
  READY:         'COMPLETED',
}

// POST /api/services/[id]/status — advance to next stage
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'service.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const serviceId = Number(id)

  const service = await prisma.serviceOrder.findUnique({
    where:   { id: serviceId },
    include: {
      sections: {
        include: {
          checklistItems: true,
          workCards:      true,
        },
      },
      equipmentCheckItems: true,
    },
  })
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const nextStatus = TRANSITIONS[service.status]
  if (!nextStatus) {
    return NextResponse.json({ error: 'Невалиден преход на статус.' }, { status: 422 })
  }

  const body       = await request.json().catch(() => ({}))
  const { force }  = body  // if true, skip warnings

  const warnings: string[] = []

  // ── Stage-specific checks ─────────────────────────────────────────────────

  if (service.status === 'INTAKE') {
    // INTAKE → IN_PROGRESS: warn if intake equipment check not completed/skipped
    const eqSection = service.sections.find((s) => s.type === 'EQUIPMENT_CHECK')
    if (eqSection && !eqSection.intakeSkippedAt) {
      const hasIntakeItems = await prisma.equipmentCheckItem.findFirst({
        where: { serviceOrderId: serviceId, checkType: 'INTAKE' },
      })
      if (!hasIntakeItems) {
        warnings.push('Проверката на оборудване при приемане не е попълнена.')
      }
    }
  }

  if (service.status === 'IN_PROGRESS') {
    // IN_PROGRESS → QUALITY_CHECK: warn if any work cards still Pending/Assigned/In_Progress
    const hasOpenCards = service.sections.some((s) =>
      s.workCards.some((wc) =>
        wc.status === 'PENDING' || wc.status === 'ASSIGNED' || wc.status === 'IN_PROGRESS',
      ),
    )
    if (hasOpenCards) {
      warnings.push('Има незавършени работни карти.')
    }
  }

  if (service.status === 'QUALITY_CHECK') {
    // QUALITY_CHECK → READY: warn if exit equipment check not done or items still missing
    const eqSection = service.sections.find((s) => s.type === 'EQUIPMENT_CHECK')
    if (eqSection && !eqSection.exitSkippedAt) {
      const hasExitItems = await prisma.equipmentCheckItem.findFirst({
        where: { serviceOrderId: serviceId, checkType: 'EXIT' },
      })
      if (!hasExitItems) {
        warnings.push('Проверката на оборудване при изход не е попълнена.')
      }
      const missingItems = await prisma.equipmentCheckItem.findFirst({
        where: { serviceOrderId: serviceId, checkType: 'EXIT', status: 'MISSING' },
      })
      if (missingItems) {
        warnings.push('Има липсващо оборудване в изходната проверка.')
      }
    }
  }

  // If there are warnings and force is not set, return them
  if (warnings.length > 0 && !force) {
    return NextResponse.json({ warnings }, { status: 200 })
  }

  // ── Perform transition ────────────────────────────────────────────────────

  const updateData: Record<string, unknown> = { status: nextStatus }

  if (nextStatus === 'IN_PROGRESS') {
    // Auto-advance all PENDING work cards to IN_PROGRESS
    await prisma.workCard.updateMany({
      where: {
        status:          'PENDING',
        serviceSection:  { serviceOrderId: serviceId },
      },
      data: { status: 'IN_PROGRESS' },
    })
  }

  if (nextStatus === 'COMPLETED') {
    updateData.endDate = new Date()

    // Create TruckEquipmentSnapshot from EXIT check (fallback to INTAKE if exit skipped)
    const eqSection     = service.sections.find((s) => s.type === 'EQUIPMENT_CHECK')
    const exitSkipped   = eqSection?.exitSkippedAt != null
    const sourceType    = exitSkipped ? 'INTAKE' : 'EXIT'
    const sourceItems   = service.equipmentCheckItems.filter((i) => i.checkType === sourceType)

    if (sourceItems.length > 0) {
      await prisma.truckEquipmentSnapshot.create({
        data: {
          truckId:        service.truckId,
          serviceOrderId: serviceId,
          items: {
            create: sourceItems.map((i) => ({
              itemName: i.itemName,
              status:   i.status,
            })),
          },
        },
      })
    }
  }

  const updated = await prisma.serviceOrder.update({
    where:   { id: serviceId },
    data:    updateData,
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

  await logAudit({
    ...auditActor(session),
    action:     'service.status_change',
    entityType: 'ServiceOrder',
    entityId:   serviceId,
    oldValue:   { status: service.status },
    newValue:   { status: nextStatus },
  })

  return NextResponse.json({ service: updated })
}
