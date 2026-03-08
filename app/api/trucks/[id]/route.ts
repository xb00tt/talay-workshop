import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { logAudit, auditActor } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

async function getTruck(id: string) {
  const truckId = Number(id)
  if (isNaN(truckId)) return null
  return prisma.truck.findUnique({ where: { id: truckId } })
}

// PATCH /api/trucks/[id]
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const truck = await getTruck(id)
  if (!truck) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { plateNumber, make, model, year, isAdr, mileageTriggerKm, currentMileage, isActive } = body

  // Deactivate/activate requires truck.deactivate
  if (isActive !== undefined && !hasPermission(session.user.role, session.user.permissions, 'truck.deactivate')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Edit fields require truck.edit
  if ((plateNumber ?? make ?? model ?? year ?? isAdr ?? mileageTriggerKm ?? currentMileage) !== undefined) {
    if (!hasPermission(session.user.role, session.user.permissions, 'truck.edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Check plate uniqueness if changing
  if (plateNumber !== undefined && plateNumber.trim().toUpperCase() !== truck.plateNumber) {
    const dup = await prisma.truck.findUnique({ where: { plateNumber: plateNumber.trim().toUpperCase() } })
    if (dup) return NextResponse.json({ error: 'Камион с този рег. номер вече съществува.' }, { status: 409 })
  }

  const data: Record<string, unknown> = {}
  if (plateNumber     !== undefined) data.plateNumber     = plateNumber.trim().toUpperCase()
  if (make            !== undefined) data.make            = make.trim()
  if (model           !== undefined) data.model           = model.trim()
  if (year            !== undefined) data.year            = year ? Number(year) : null
  if (isAdr           !== undefined) data.isAdr           = Boolean(isAdr)
  if (mileageTriggerKm !== undefined) data.mileageTriggerKm = Number(mileageTriggerKm)
  if (currentMileage  !== undefined) data.currentMileage  = currentMileage != null ? Number(currentMileage) : null
  if (isActive        !== undefined) data.isActive        = Boolean(isActive)

  const updated = await prisma.truck.update({ where: { id: truck.id }, data })
  const action = isActive !== undefined ? (data.isActive ? 'truck.activate' : 'truck.deactivate') : 'truck.update'
  await logAudit({
    ...auditActor(session),
    action,
    entityType: 'Truck',
    entityId:   truck.id,
    oldValue:   { plateNumber: truck.plateNumber, isActive: truck.isActive },
    newValue:   data,
  })
  return NextResponse.json({ truck: updated })
}
