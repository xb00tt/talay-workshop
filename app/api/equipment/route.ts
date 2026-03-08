import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [items, adrItems] = await Promise.all([
    prisma.equipmentItem.findMany({ orderBy: { order: 'asc' } }),
    prisma.adrEquipmentItem.findMany({ orderBy: { order: 'asc' } }),
  ])
  return NextResponse.json({ items, adrItems })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'equipment.edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, description, isAdr } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Въведете наименование.' }, { status: 422 })

  if (isAdr) {
    const last = await prisma.adrEquipmentItem.findFirst({ orderBy: { order: 'desc' } })
    const item = await prisma.adrEquipmentItem.create({
      data: { name: name.trim(), description: description?.trim() ?? null, order: (last?.order ?? 0) + 1, isActive: true },
    })
    return NextResponse.json({ item }, { status: 201 })
  } else {
    const last = await prisma.equipmentItem.findFirst({ orderBy: { order: 'desc' } })
    const item = await prisma.equipmentItem.create({
      data: { name: name.trim(), description: description?.trim() ?? null, order: (last?.order ?? 0) + 1, isActive: true },
    })
    return NextResponse.json({ item }, { status: 201 })
  }
}
