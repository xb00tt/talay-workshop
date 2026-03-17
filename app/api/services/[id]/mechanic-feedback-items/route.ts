import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// POST /api/services/[id]/mechanic-feedback-items
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const serviceId = Number(id)

  const service = await prisma.serviceOrder.findUnique({ where: { id: serviceId } })
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (service.status === 'COMPLETED' || service.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Приключената поръчка не може да се редактира.' }, { status: 422 })
  }

  const { description } = await request.json()
  if (!description?.trim()) return NextResponse.json({ error: 'Въведете описание.' }, { status: 422 })

  const maxOrder = await prisma.mechanicFeedbackItem.aggregate({
    where: { serviceOrderId: serviceId },
    _max:  { order: true },
  })

  const item = await prisma.mechanicFeedbackItem.create({
    data: {
      serviceOrderId: serviceId,
      description:    description.trim(),
      order:          (maxOrder._max.order ?? 0) + 1,
    },
  })

  return NextResponse.json({ item }, { status: 201 })
}
