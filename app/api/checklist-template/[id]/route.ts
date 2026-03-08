import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function requireEdit(session: any) {
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'checklist.edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  const deny = requireEdit(session)
  if (deny) return deny

  const { id } = await params
  const itemId = Number(id)

  const body = await request.json()
  const data: Record<string, unknown> = {}

  if ('description' in body) {
    if (!body.description?.trim()) {
      return NextResponse.json({ error: 'Въведете описание.' }, { status: 422 })
    }
    data.description = body.description.trim()
  }
  if ('isActive' in body) data.isActive = Boolean(body.isActive)
  if ('order' in body) data.order = Number(body.order)

  const item = await prisma.checklistTemplate.update({ where: { id: itemId }, data })
  return NextResponse.json({ item })
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  const deny = requireEdit(session)
  if (deny) return deny

  const { id } = await params
  const itemId = Number(id)

  await prisma.checklistTemplate.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
