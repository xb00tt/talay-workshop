import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const items = await prisma.checklistTemplate.findMany({
    orderBy: { order: 'asc' },
  })
  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'checklist.edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { description } = await request.json()
  if (!description?.trim()) {
    return NextResponse.json({ error: 'Въведете описание.' }, { status: 422 })
  }

  const last = await prisma.checklistTemplate.findFirst({ orderBy: { order: 'desc' } })
  const order = (last?.order ?? 0) + 1

  const item = await prisma.checklistTemplate.create({
    data: { description: description.trim(), order, isActive: true },
  })
  return NextResponse.json({ item }, { status: 201 })
}
