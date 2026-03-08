import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { logAudit, auditActor } from '@/lib/audit'

async function authorize() {
  const session = await getServerSession(authOptions)
  if (!session) return { session: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!hasPermission(session.user.role, session.user.permissions, 'bay.manage')) {
    return { session: null, err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session, err: null }
}

// GET /api/bays
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bays = await prisma.bay.findMany({ orderBy: { id: 'asc' } })
  return NextResponse.json({ bays })
}

// POST /api/bays
export async function POST(request: Request) {
  const { err, session } = await authorize()
  if (err) return err

  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Името е задължително.' }, { status: 422 })

  const bay = await prisma.bay.create({ data: { name: name.trim() } })
  await logAudit({ ...auditActor(session), action: 'bay.create', entityType: 'Bay', entityId: bay.id, newValue: { name: bay.name } })
  return NextResponse.json({ bay }, { status: 201 })
}
