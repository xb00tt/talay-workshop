import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { logAudit, auditActor } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

// GET /api/services/[id]
export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const service = await prisma.serviceOrder.findUnique({
    where: { id: Number(id) },
    include: {
      truck:    { select: { id: true, make: true, model: true, year: true, isAdr: true, frotcomVehicleId: true } },
      bay:      { select: { id: true, name: true } },
      driver:   { select: { id: true, name: true } },
      sections: {
        orderBy:  { order: 'asc' },
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

  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ service })
}

// PATCH /api/services/[id] — reschedule (date only) or cancel
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const serviceId = Number(id)
  const service   = await prisma.serviceOrder.findUnique({ where: { id: serviceId } })
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { scheduledDate, status, cancellationReason } = body

  // Reschedule
  if (scheduledDate !== undefined) {
    if (!hasPermission(session.user.role, session.user.permissions, 'service.reschedule')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (service.status !== 'SCHEDULED') {
      return NextResponse.json({ error: 'Само планирани поръчки могат да се пренасрочват.' }, { status: 422 })
    }
    const date = new Date(scheduledDate + 'T00:00:00.000Z')
    if (isNaN(date.getTime())) return NextResponse.json({ error: 'Невалидна дата.' }, { status: 422 })

    const updated = await prisma.serviceOrder.update({
      where: { id: serviceId },
      data:  { scheduledDate: date },
      include: { truck: { select: { make: true, model: true } } },
    })
    await logAudit({
      ...auditActor(session),
      action:     'service.reschedule',
      entityType: 'ServiceOrder',
      entityId:   serviceId,
      oldValue:   { scheduledDate: service.scheduledDate },
      newValue:   { scheduledDate: date },
    })
    return NextResponse.json({ service: updated })
  }

  // Cancel
  if (status === 'CANCELLED') {
    if (!hasPermission(session.user.role, session.user.permissions, 'service.cancel')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!cancellationReason?.trim()) {
      return NextResponse.json({ error: 'Причината за отмяна е задължителна.' }, { status: 422 })
    }
    const updated = await prisma.serviceOrder.update({
      where: { id: serviceId },
      data:  { status: 'CANCELLED', cancellationReason: cancellationReason.trim() },
      include: { truck: { select: { make: true, model: true } } },
    })
    await logAudit({
      ...auditActor(session),
      action:     'service.cancel',
      entityType: 'ServiceOrder',
      entityId:   serviceId,
      oldValue:   { status: service.status },
      newValue:   { status: 'CANCELLED', cancellationReason: cancellationReason.trim() },
    })
    return NextResponse.json({ service: updated })
  }

  // Update driver feedback notes
  if ('driverFeedbackNotes' in body) {
    const updated = await prisma.serviceOrder.update({
      where: { id: serviceId },
      data:  { driverFeedbackNotes: body.driverFeedbackNotes?.trim() ?? null },
      include: { truck: { select: { make: true, model: true } } },
    })
    return NextResponse.json({ service: updated })
  }

  return NextResponse.json({ error: 'Unsupported operation' }, { status: 400 })
}
