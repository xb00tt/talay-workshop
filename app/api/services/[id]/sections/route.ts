import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { logAudit, auditActor } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

// POST /api/services/[id]/sections — add a section
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'service.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const serviceId = Number(id)

  const service = await prisma.serviceOrder.findUnique({ where: { id: serviceId } })
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (service.status === 'COMPLETED' || service.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Приключената поръчка не може да се редактира.' }, { status: 422 })
  }

  const body = await request.json()
  const { type, title } = body

  if (!type || !['DRIVER_FEEDBACK', 'MID_SERVICE', 'CUSTOM'].includes(type)) {
    return NextResponse.json({ error: 'Невалиден тип раздел.' }, { status: 422 })
  }
  if (!title?.trim()) return NextResponse.json({ error: 'Въведете заглавие.' }, { status: 422 })

  const maxOrder = await prisma.serviceSection.aggregate({
    where: { serviceOrderId: serviceId },
    _max: { order: true },
  })

  const section = await prisma.serviceSection.create({
    data: {
      serviceOrderId: serviceId,
      type,
      title:          title.trim(),
      order:          (maxOrder._max.order ?? 0) + 1,
    },
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
  })

  await logAudit({
    ...auditActor(session),
    action:     'section.create',
    entityType: 'ServiceSection',
    entityId:   section.id,
    newValue:   { serviceOrderId: serviceId, type, title: section.title },
  })

  return NextResponse.json({ section }, { status: 201 })
}
