import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { logAudit, auditActor } from '@/lib/audit'
import { SERVICE_FULL_INCLUDE } from '@/lib/service-includes'

type Params = { params: Promise<{ id: string }> }

// Allowed forward transitions
const TRANSITIONS: Record<string, string> = {
  INTAKE:      'IN_PROGRESS',
  IN_PROGRESS: 'READY',
  READY:       'COMPLETED',
}

// Allowed regression transitions
const REGRESSIONS: Record<string, string> = {
  READY: 'IN_PROGRESS',
}

// POST /api/services/[id]/status — advance or regress stage
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'service.advance')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const serviceId = Number(id)

  const body = await request.json().catch(() => ({}))

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

  // ── Regression (READY → IN_PROGRESS) ─────────────────────────────────────
  if (body.action === 'regress') {
    const prevStatus = REGRESSIONS[service.status]
    if (!prevStatus) {
      return NextResponse.json({ error: 'Невалиден преход на статус.' }, { status: 422 })
    }
    const updated = await prisma.serviceOrder.update({
      where: { id: serviceId },
      data:  { status: prevStatus as 'IN_PROGRESS' },
      include: SERVICE_FULL_INCLUDE,
    })
    await logAudit({
      ...auditActor(session),
      action:     'service.status_regress',
      entityType: 'ServiceOrder',
      entityId:   serviceId,
      oldValue:   { status: service.status },
      newValue:   { status: prevStatus },
    })
    return NextResponse.json({ service: updated })
  }

  // ── Forward transition ──────────────────────────────────────────────────────
  const nextStatus = TRANSITIONS[service.status]
  if (!nextStatus) {
    return NextResponse.json({ error: 'Невалиден преход на статус.' }, { status: 422 })
  }

  const { force } = body  // if true, skip warnings

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
    // IN_PROGRESS → READY: warn if any work cards still Pending/In_Progress
    const hasOpenCards = service.sections.some((s) =>
      s.workCards.some((wc) =>
        wc.status === 'PENDING' || wc.status === 'IN_PROGRESS',
      ),
    )
    if (hasOpenCards) {
      warnings.push('Има незавършени работни карти.')
    }
    // Warn if exit equipment check not done or items still missing
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
    include: SERVICE_FULL_INCLUDE,
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
