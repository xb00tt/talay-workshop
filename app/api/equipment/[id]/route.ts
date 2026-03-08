import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function requireEdit(session: any) {
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'equipment.edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

function parseEquipmentId(id: string): { type: 'global' | 'adr'; itemId: number } | null {
  const dashIdx = id.indexOf('-')
  if (dashIdx === -1) return null
  const type  = id.slice(0, dashIdx)
  const rawId = id.slice(dashIdx + 1)
  if (type !== 'global' && type !== 'adr') return null
  const itemId = Number(rawId)
  if (!Number.isInteger(itemId) || itemId <= 0) return null
  return { type, itemId }
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  const deny = requireEdit(session)
  if (deny) return deny

  const { id } = await params
  const parsed = parseEquipmentId(id)
  if (!parsed) return NextResponse.json({ error: 'Invalid equipment ID' }, { status: 400 })
  const { type, itemId } = parsed

  const body = await request.json()
  const data: Record<string, unknown> = {}
  if ('name' in body) {
    if (!body.name?.trim()) return NextResponse.json({ error: 'Въведете наименование.' }, { status: 422 })
    data.name = body.name.trim()
  }
  if ('description' in body) data.description = body.description?.trim() ?? null
  if ('isActive' in body) data.isActive = Boolean(body.isActive)
  if ('order' in body) data.order = Number(body.order)

  if (type === 'adr') {
    const item = await prisma.adrEquipmentItem.update({ where: { id: itemId }, data })
    return NextResponse.json({ item })
  } else {
    const item = await prisma.equipmentItem.update({ where: { id: itemId }, data })
    return NextResponse.json({ item })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  const deny = requireEdit(session)
  if (deny) return deny

  const { id } = await params
  const parsed = parseEquipmentId(id)
  if (!parsed) return NextResponse.json({ error: 'Invalid equipment ID' }, { status: 400 })
  const { type, itemId } = parsed

  if (type === 'adr') {
    await prisma.adrEquipmentItem.delete({ where: { id: itemId } })
  } else {
    await prisma.equipmentItem.delete({ where: { id: itemId } })
  }
  return NextResponse.json({ ok: true })
}
