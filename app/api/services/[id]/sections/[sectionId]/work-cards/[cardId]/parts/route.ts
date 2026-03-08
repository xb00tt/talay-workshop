import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string; sectionId: string; cardId: string }> }

// POST /api/services/[id]/sections/[sectionId]/work-cards/[cardId]/parts
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, sectionId, cardId } = await params
  const serviceId = Number(id)
  const secId     = Number(sectionId)
  const wcId      = Number(cardId)

  const workCard = await prisma.workCard.findFirst({
    where: {
      id:             wcId,
      serviceSectionId: secId,
      serviceSection: { serviceOrderId: serviceId },
    },
  })
  if (!workCard) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (workCard.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Не може да се добавят части към отменена карта.' }, { status: 422 })
  }

  const body = await request.json()
  const { name, partNumber, quantity, unitCost } = body

  if (!name?.trim())    return NextResponse.json({ error: 'Въведете наименование.' }, { status: 422 })
  if (!quantity || Number(quantity) <= 0) return NextResponse.json({ error: 'Въведете количество.' }, { status: 422 })

  const part = await prisma.part.create({
    data: {
      workCardId: wcId,
      name:       name.trim(),
      partNumber: partNumber?.trim() || null,
      quantity:   Number(quantity),
      unitCost:   unitCost ? Number(unitCost) : null,
    },
  })

  return NextResponse.json({ part }, { status: 201 })
}
