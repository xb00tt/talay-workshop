import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string; sectionId: string; itemId: string }> }

// PATCH /api/services/[id]/sections/[sectionId]/checklist-items/[itemId]
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'service.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, sectionId, itemId } = await params
  const serviceId = Number(id)
  const secId     = Number(sectionId)
  const iId       = Number(itemId)

  const item = await prisma.serviceChecklistItem.findFirst({
    where:   { id: iId, serviceSectionId: secId },
    include: { serviceSection: { select: { serviceOrderId: true } } },
  })
  if (!item || item.serviceSection.serviceOrderId !== serviceId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { isCompleted } = await request.json()

  const updated = await prisma.serviceChecklistItem.update({
    where: { id: iId },
    data: {
      isCompleted,
      completedAt:     isCompleted ? new Date() : null,
      completedByName: isCompleted ? (session.user.name ?? null) : null,
    },
  })

  return NextResponse.json({ item: updated })
}
