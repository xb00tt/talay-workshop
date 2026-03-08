import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string; sectionId: string; cardId: string; partId: string }> }

// DELETE /api/services/[id]/sections/[sectionId]/work-cards/[cardId]/parts/[partId]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, sectionId, cardId, partId } = await params
  const serviceId = Number(id)
  const secId     = Number(sectionId)
  const wcId      = Number(cardId)
  const pId       = Number(partId)

  const part = await prisma.part.findFirst({
    where: {
      id:       pId,
      workCardId: wcId,
      workCard: {
        serviceSectionId: secId,
        serviceSection:   { serviceOrderId: serviceId },
      },
    },
  })
  if (!part) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.part.delete({ where: { id: pId } })
  return NextResponse.json({ success: true })
}
