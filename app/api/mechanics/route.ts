import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { logAudit, auditActor } from '@/lib/audit'

async function authorize() {
  const session = await getServerSession(authOptions)
  if (!session) return { session: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!hasPermission(session.user.role, session.user.permissions, 'mechanic.manage')) {
    return { session: null, err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session, err: null }
}

// GET /api/mechanics
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mechanics = await prisma.mechanic.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ mechanics })
}

// POST /api/mechanics
export async function POST(request: Request) {
  const { err, session } = await authorize()
  if (err) return err

  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Името е задължително.' }, { status: 422 })

  const mechanic = await prisma.mechanic.create({ data: { name: name.trim() } })

  await logAudit({
    ...auditActor(session),
    action:     'mechanic.create',
    entityType: 'Mechanic',
    entityId:   mechanic.id,
    newValue:   { name: mechanic.name },
  })

  return NextResponse.json({ mechanic }, { status: 201 })
}
