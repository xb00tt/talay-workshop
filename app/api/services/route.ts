import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { logAudit, auditActor } from '@/lib/audit'

// GET /api/services
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status   = searchParams.get('status') ?? 'active'
  const q        = searchParams.get('q')?.trim() ?? ''
  const page     = Math.max(1, Number(searchParams.get('page')     ?? '1'))
  const pageSize = Math.min(100, Math.max(5, Number(searchParams.get('pageSize') ?? '10')))

  const statusWhere =
    status === 'active' ? { status: { notIn: ['COMPLETED', 'CANCELLED'] as never[] } } :
    status === 'all'    ? {} :
                         { status: status as never }

  const searchWhere = q ? {
    OR: [
      { truckPlateSnapshot: { contains: q } },
      { truck: { make:  { contains: q } } },
      { truck: { model: { contains: q } } },
    ],
  } : {}

  const where = { ...statusWhere, ...searchWhere }

  const [services, total] = await Promise.all([
    prisma.serviceOrder.findMany({
      where,
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      include: {
        truck:    { select: { make: true, model: true, isAdr: true } },
        sections: { select: { workCards: { select: { status: true } } } },
      },
    }),
    prisma.serviceOrder.count({ where }),
  ])

  return NextResponse.json({
    services,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}

// POST /api/services — create service order
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'service.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { truckId, scheduledDate } = body

  if (!truckId)       return NextResponse.json({ error: 'Изберете камион.' }, { status: 422 })
  if (!scheduledDate) return NextResponse.json({ error: 'Изберете дата.' }, { status: 422 })

  const truck = await prisma.truck.findUnique({ where: { id: Number(truckId) } })
  if (!truck)         return NextResponse.json({ error: 'Камионът не е намерен.' }, { status: 404 })
  if (!truck.isActive) return NextResponse.json({ error: 'Камионът е неактивен.' }, { status: 422 })

  // Hard block: one active service per truck
  const active = await prisma.serviceOrder.findFirst({
    where: {
      truckId: truck.id,
      status:  { notIn: ['COMPLETED', 'CANCELLED'] },
    },
  })
  if (active) {
    return NextResponse.json(
      { error: 'Камионът вече има активна сервизна поръчка.' },
      { status: 409 },
    )
  }

  // Parse scheduledDate as UTC midnight
  const date = new Date(scheduledDate + 'T00:00:00.000Z')
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Невалидна дата.' }, { status: 422 })
  }

  const service = await prisma.serviceOrder.create({
    data: {
      truckId:           truck.id,
      truckPlateSnapshot: truck.plateNumber,
      scheduledDate:     date,
      status:            'SCHEDULED',
    },
    include: {
      truck: { select: { make: true, model: true } },
    },
  })

  await logAudit({
    ...auditActor(session),
    action:     'service.create',
    entityType: 'ServiceOrder',
    entityId:   service.id,
    newValue:   { truckId: service.truckId, plate: service.truckPlateSnapshot, scheduledDate },
  })

  return NextResponse.json({ service }, { status: 201 })
}
