import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { logAudit, auditActor } from '@/lib/audit'

type Params = { params: Promise<{ id: string; sectionId: string }> }

// POST /api/services/[id]/sections/[sectionId]/work-cards
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'workcard.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, sectionId } = await params
  const serviceId = Number(id)
  const secId     = Number(sectionId)

  const [service, section] = await Promise.all([
    prisma.serviceOrder.findUnique({ where: { id: serviceId } }),
    prisma.serviceSection.findFirst({ where: { id: secId, serviceOrderId: serviceId } }),
  ])
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!section)  return NextResponse.json({ error: 'Разделът не е намерен.' }, { status: 404 })

  if (section.type === 'CHECKLIST' || section.type === 'EQUIPMENT_CHECK') {
    return NextResponse.json({ error: 'Не може да се добавят работни карти в този раздел.' }, { status: 422 })
  }
  if (service.status === 'COMPLETED' || service.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Приключената поръчка не може да се редактира.' }, { status: 422 })
  }

  const body = await request.json()
  const { description, mechanicId, specialInstructions } = body

  if (!description?.trim()) return NextResponse.json({ error: 'Въведете описание.' }, { status: 422 })

  let mechanic: { id: number; name: string } | null = null
  if (mechanicId) {
    mechanic = await prisma.mechanic.findUnique({ where: { id: Number(mechanicId) } })
    if (!mechanic) return NextResponse.json({ error: 'Механикът не е намерен.' }, { status: 404 })
  }

  const workCard = await prisma.workCard.create({
    data: {
      serviceSectionId:    secId,
      description:         description.trim(),
      mechanicId:          mechanic?.id ?? null,
      mechanicName:        mechanic?.name ?? null,
      status:              'PENDING',
      specialInstructions: specialInstructions?.trim() ?? null,
    },
    include: {
      mechanic: { select: { id: true, name: true } },
      parts:    true,
      notes:    { orderBy: { createdAt: 'asc' } },
      photos:   true,
    },
  })

  await logAudit({
    ...auditActor(session),
    action:     'workcard.create',
    entityType: 'WorkCard',
    entityId:   workCard.id,
    newValue:   { serviceOrderId: serviceId, sectionId: secId, description: workCard.description, mechanicName: workCard.mechanicName },
  })

  return NextResponse.json({ workCard }, { status: 201 })
}
