import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { logAudit, auditActor } from '@/lib/audit'

// GET /api/trucks
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const trucks = await prisma.truck.findMany({
    orderBy: { plateNumber: 'asc' },
  })
  return NextResponse.json({ trucks })
}

// POST /api/trucks — create manual truck
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'truck.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { plateNumber, make, model, year, isAdr, mileageTriggerKm, currentMileage } = body

  if (!plateNumber?.trim()) return NextResponse.json({ error: 'Регистрационният номер е задължителен.' }, { status: 422 })
  if (!make?.trim())        return NextResponse.json({ error: 'Марката е задължителна.' }, { status: 422 })
  if (!model?.trim())       return NextResponse.json({ error: 'Моделът е задължителен.' }, { status: 422 })

  const existing = await prisma.truck.findUnique({ where: { plateNumber: plateNumber.trim().toUpperCase() } })
  if (existing) return NextResponse.json({ error: 'Камион с този рег. номер вече съществува.' }, { status: 409 })

  const truck = await prisma.truck.create({
    data: {
      plateNumber:     plateNumber.trim().toUpperCase(),
      make:            make.trim(),
      model:           model.trim(),
      year:            year ? Number(year) : null,
      isAdr:           Boolean(isAdr),
      mileageTriggerKm: mileageTriggerKm ? Number(mileageTriggerKm) : 30000,
      currentMileage:  currentMileage != null ? Number(currentMileage) : null,
    },
  })

  await logAudit({
    ...auditActor(session),
    action:     'truck.create',
    entityType: 'Truck',
    entityId:   truck.id,
    newValue:   { plateNumber: truck.plateNumber, make: truck.make, model: truck.model },
  })

  return NextResponse.json({ truck }, { status: 201 })
}
