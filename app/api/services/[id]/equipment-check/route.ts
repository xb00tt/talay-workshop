import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// POST /api/services/[id]/equipment-check
// Body: { checkType: 'INTAKE'|'EXIT', items: { itemName: string, status: 'PRESENT'|'MISSING'|'RESTOCKED', explanation?: string }[] }
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'equipment.edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const serviceId = Number(id)

  const service = await prisma.serviceOrder.findUnique({ where: { id: serviceId } })
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (service.status === 'COMPLETED' || service.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Приключената поръчка не може да се редактира.' }, { status: 422 })
  }

  const { checkType, items } = await request.json() as {
    checkType: 'INTAKE' | 'EXIT'
    items: { itemName: string; status: 'PRESENT' | 'MISSING' | 'RESTOCKED'; explanation?: string }[]
  }

  if (!['INTAKE', 'EXIT'].includes(checkType)) {
    return NextResponse.json({ error: 'Invalid checkType' }, { status: 422 })
  }
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'items must be array' }, { status: 422 })
  }

  // Delete existing items for this checkType, then re-create
  await prisma.$transaction([
    prisma.equipmentCheckItem.deleteMany({ where: { serviceOrderId: serviceId, checkType } }),
    prisma.equipmentCheckItem.createMany({
      data: items.map((item) => ({
        serviceOrderId: serviceId,
        itemName:       item.itemName,
        status:         item.status,
        explanation:    item.explanation?.trim() || null,
        checkType,
      })),
    }),
  ])

  const saved = await prisma.equipmentCheckItem.findMany({
    where: { serviceOrderId: serviceId, checkType },
    orderBy: { id: 'asc' },
  })

  return NextResponse.json({ items: saved })
}
