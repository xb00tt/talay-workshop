import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string; itemId: string }> }

// DELETE /api/services/[id]/feedback-items/[itemId]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, itemId } = await params
  const serviceId = Number(id)
  const iId       = Number(itemId)

  const item = await prisma.driverFeedbackItem.findFirst({
    where: { id: iId, serviceOrderId: serviceId },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.driverFeedbackItem.delete({ where: { id: iId } })
  return NextResponse.json({ success: true })
}
