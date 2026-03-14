import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { logAudit, auditActor } from '@/lib/audit'

async function authorize() {
  const session = await getServerSession(authOptions)
  if (!session) return { session: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (session.user.role !== 'ADMIN') {
    return { session: null, err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session, err: null }
}

// GET /api/users — list all users
export async function GET() {
  const { err } = await authorize()
  if (err) return err

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
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

  return NextResponse.json({ users })
}

// POST /api/users — create user
export async function POST(request: Request) {
  const { err, session: actorSession } = await authorize()
  if (err) return err

  const body = await request.json()
  const { username, name, role, password } = body

  if (!username?.trim()) return NextResponse.json({ error: 'Потребителското име е задължително.' }, { status: 422 })
  if (!/^[a-z0-9_.-]+$/.test(username)) return NextResponse.json({ error: 'Само малки букви, цифри, _ . -' }, { status: 422 })
  if (!name?.trim()) return NextResponse.json({ error: 'Пълното име е задължително.' }, { status: 422 })
  if (!['MANAGER', 'ASSISTANT'].includes(role)) return NextResponse.json({ error: 'Невалидна роля.' }, { status: 422 })
  if (!password || password.length < 8) return NextResponse.json({ error: 'Паролата трябва да е поне 8 символа.' }, { status: 422 })

  const existing = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } })
  if (existing) return NextResponse.json({ error: 'Потребителското име вече съществува.' }, { status: 409 })

  const recoveryCode = crypto.randomBytes(6).toString('hex').toUpperCase()
  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      username: username.trim().toLowerCase(),
      name: name.trim(),
      role,
      passwordHash,
      permissions: '[]',
      recoveryCode,
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
    action:     'user.create',
    entityType: 'User',
    entityId:   user.id,
    newValue:   { username: user.username, name: user.name, role: user.role },
  })

  return NextResponse.json({ user, recoveryCode }, { status: 201 })
}
