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

// PATCH /api/bays/[id] — rename or toggle active
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { err, session } = await authorize()
  if (err) return err

  const { id } = await params
  const bayId = Number(id)
  if (isNaN(bayId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await request.json()
  const { name, isActive } = body

  if (name !== undefined && !name.trim()) {
    return NextResponse.json({ error: 'Името е задължително.' }, { status: 422 })
  }

  const bay = await prisma.bay.findUnique({ where: { id: bayId } })
  if (!bay) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.bay.update({
    where: { id: bayId },
    data: {
      ...(name     !== undefined && { name: name.trim() }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    },
  })

  await logAudit({
    ...auditActor(session),
    action:     isActive !== undefined ? (updated.isActive ? 'bay.activate' : 'bay.deactivate') : 'bay.update',
    entityType: 'Bay',
    entityId:   bayId,
    oldValue:   { name: bay.name, isActive: bay.isActive },
    newValue:   { name: updated.name, isActive: updated.isActive },
  })

  return NextResponse.json({ bay: updated })
}
