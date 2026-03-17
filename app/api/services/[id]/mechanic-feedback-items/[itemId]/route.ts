import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string; itemId: string }> }

// PATCH /api/services/[id]/mechanic-feedback-items/[itemId]
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'service.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, itemId } = await params
  const serviceId = Number(id)
  const iId       = Number(itemId)

  const item = await prisma.mechanicFeedbackItem.findFirst({
    where: { id: iId, serviceOrderId: serviceId },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { description } = await request.json()
  if (!description?.trim()) return NextResponse.json({ error: 'Въведете описание.' }, { status: 422 })

  const updated = await prisma.mechanicFeedbackItem.update({
    where: { id: iId },
    data:  { description: description.trim() },
  })

  return NextResponse.json({ item: updated })
}

// DELETE /api/services/[id]/mechanic-feedback-items/[itemId]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'service.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, itemId } = await params
  const serviceId = Number(id)
  const iId       = Number(itemId)

  const item = await prisma.mechanicFeedbackItem.findFirst({
    where: { id: iId, serviceOrderId: serviceId },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.mechanicFeedbackItem.delete({ where: { id: iId } })
  return NextResponse.json({ success: true })
}
