import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { logAudit, auditActor } from '@/lib/audit'

type Params = { params: Promise<{ id: string; sectionId: string; cardId: string }> }

const WC_INCLUDE = {
  mechanic: { select: { id: true, name: true } },
  parts:    true,
  notes:    { orderBy: { createdAt: 'asc' as const } },
  photos:   true,
}

// PATCH /api/services/[id]/sections/[sectionId]/work-cards/[cardId]
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, sectionId, cardId } = await params
  const serviceId = Number(id)
  const secId     = Number(sectionId)
  const wcId      = Number(cardId)

  const workCard = await prisma.workCard.findFirst({
    where: { id: wcId, serviceSectionId: secId, serviceSection: { serviceOrderId: serviceId } },
  })
  if (!workCard) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { status, description, mechanicId, specialInstructions } = body

  // ── Status transitions ─────────────────────────────────────────────────────
  if (status !== undefined) {
    if (status === 'CANCELLED') {
      if (!hasPermission(session.user.role, session.user.permissions, 'workcard.cancel')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (workCard.status === 'CANCELLED' || workCard.status === 'COMPLETED') {
        return NextResponse.json({ error: 'Невалиден статус.' }, { status: 422 })
      }
      const updated = await prisma.workCard.update({
        where: { id: wcId },
        data:  { status: 'CANCELLED', cancelledAt: new Date() },
        include: WC_INCLUDE,
      })
      await logAudit({ ...auditActor(session), action: 'workcard.cancel', entityType: 'WorkCard', entityId: wcId, oldValue: { status: workCard.status }, newValue: { status: 'CANCELLED' } })
      return NextResponse.json({ workCard: updated })
    }

    if (status === 'REOPEN') {
      if (!hasPermission(session.user.role, session.user.permissions, 'workcard.reopen')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (workCard.status !== 'CANCELLED') {
        return NextResponse.json({ error: 'Само отменени карти могат да се отворят отново.' }, { status: 422 })
      }
      const updated = await prisma.workCard.update({
        where: { id: wcId },
        data:  { status: 'IN_PROGRESS', reopenedAt: new Date(), cancelledAt: null },
        include: WC_INCLUDE,
      })
      await logAudit({ ...auditActor(session), action: 'workcard.reopen', entityType: 'WorkCard', entityId: wcId, oldValue: { status: 'CANCELLED' }, newValue: { status: 'IN_PROGRESS' } })
      return NextResponse.json({ workCard: updated })
    }

    if (status === 'COMPLETED') {
      if (!hasPermission(session.user.role, session.user.permissions, 'workcard.complete')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (workCard.status === 'CANCELLED' || workCard.status === 'COMPLETED') {
        return NextResponse.json({ error: 'Невалиден статус.' }, { status: 422 })
      }
      const updated = await prisma.workCard.update({
        where: { id: wcId },
        data:  { status: 'COMPLETED' },
        include: WC_INCLUDE,
      })
      await logAudit({ ...auditActor(session), action: 'workcard.complete', entityType: 'WorkCard', entityId: wcId, oldValue: { status: workCard.status }, newValue: { status: 'COMPLETED' } })
      return NextResponse.json({ workCard: updated })
    }

    // Manual advance: ASSIGNED or IN_PROGRESS
    if (status === 'ASSIGNED' || status === 'IN_PROGRESS') {
      if (!hasPermission(session.user.role, session.user.permissions, 'workcard.create')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (workCard.status === 'CANCELLED' || workCard.status === 'COMPLETED') {
        return NextResponse.json({ error: 'Невалиден статус.' }, { status: 422 })
      }
      const updated = await prisma.workCard.update({
        where: { id: wcId },
        data:  { status },
        include: WC_INCLUDE,
      })
      return NextResponse.json({ workCard: updated })
    }

    return NextResponse.json({ error: 'Невалиден статус.' }, { status: 422 })
  }

  // ── Field updates ──────────────────────────────────────────────────────────
  if (!hasPermission(session.user.role, session.user.permissions, 'workcard.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data: Record<string, unknown> = {}

  if (description !== undefined) {
    if (!description?.trim()) return NextResponse.json({ error: 'Описанието е задължително.' }, { status: 422 })
    data.description = description.trim()
  }

  if ('mechanicId' in body) {
    if (mechanicId === null) {
      data.mechanicId   = null
      data.mechanicName = null
    } else {
      const mech = await prisma.mechanic.findUnique({ where: { id: Number(mechanicId) } })
      if (!mech) return NextResponse.json({ error: 'Механикът не е намерен.' }, { status: 404 })
      data.mechanicId   = mech.id
      data.mechanicName = mech.name
    }
  }

  if ('specialInstructions' in body) {
    data.specialInstructions = specialInstructions?.trim() ?? null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Няма промени.' }, { status: 400 })
  }

  const updated = await prisma.workCard.update({
    where:   { id: wcId },
    data,
    include: WC_INCLUDE,
  })
  return NextResponse.json({ workCard: updated })
}
