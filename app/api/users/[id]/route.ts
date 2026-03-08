import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { logAudit, auditActor } from '@/lib/audit'

async function authorize() {
  const session = await getServerSession(authOptions)
  if (!session) return { session: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!hasPermission(session.user.role, session.user.permissions, 'user.manage')) {
    return { session: null, err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session, err: null }
}

// PATCH /api/users/[id] — update user
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { err, session: actorSession } = await authorize()
  if (err) return err

  const { id } = await params
  const userId = Number(id)
  if (isNaN(userId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await request.json()
  const { name, role, permissions, preferredLocale, darkMode, pageSize } = body

  if (name !== undefined && !name.trim()) {
    return NextResponse.json({ error: 'Пълното име е задължително.' }, { status: 422 })
  }
  if (role !== undefined && !['MANAGER', 'ASSISTANT'].includes(role)) {
    return NextResponse.json({ error: 'Невалидна роля.' }, { status: 422 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined        && { name: name.trim() }),
      ...(role !== undefined        && { role }),
      ...(permissions !== undefined && { permissions: JSON.stringify(Array.isArray(permissions) ? permissions : []) }),
      ...(preferredLocale !== undefined && { preferredLocale }),
      ...(darkMode !== undefined    && { darkMode: Boolean(darkMode) }),
      ...(pageSize !== undefined    && { pageSize: Number(pageSize) }),
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      permissions: true,
      preferredLocale: true,
      darkMode: true,
      pageSize: true,
      createdAt: true,
    },
  })

  await logAudit({
    ...auditActor(actorSession),
    action:     'user.update',
    entityType: 'User',
    entityId:   userId,
    oldValue:   { name: user.name, role: user.role },
    newValue:   { name: updated.name, role: updated.role, permissions: updated.permissions },
  })

  return NextResponse.json({ user: updated })
}

// DELETE /api/users/[id] — delete user
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { err, session: actorSession } = await authorize()
  if (err) return err

  const { id } = await params
  const userId = Number(id)
  if (isNaN(userId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await logAudit({
    ...auditActor(actorSession),
    action:     'user.delete',
    entityType: 'User',
    entityId:   userId,
    oldValue:   { username: user.username, name: user.name, role: user.role },
  })

  await prisma.user.delete({ where: { id: userId } })

  return NextResponse.json({ ok: true })
}
