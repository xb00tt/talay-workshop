import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// POST /api/services/[id]/equipment-check/skip
// Body: { phase: 'INTAKE'|'EXIT', note?: string }
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'equipment.edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const serviceId = Number(id)

  const service = await prisma.serviceOrder.findUnique({ where: { id: serviceId } })
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (service.status === 'COMPLETED' || service.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Приключената поръчка не може да се редактира.' }, { status: 422 })
  }

  const { phase, note } = await request.json() as { phase: 'INTAKE' | 'EXIT'; note?: string }
  if (!['INTAKE', 'EXIT'].includes(phase)) {
    return NextResponse.json({ error: 'Invalid phase' }, { status: 422 })
  }

  // Find EQUIPMENT_CHECK section
  const section = await prisma.serviceSection.findFirst({
    where: { serviceOrderId: serviceId, type: 'EQUIPMENT_CHECK' },
  })
  if (!section) return NextResponse.json({ error: 'No equipment check section' }, { status: 404 })

  const skipAt   = phase === 'INTAKE' ? 'intakeSkippedAt'   : 'exitSkippedAt'
  const skipNote = phase === 'INTAKE' ? 'intakeSkipNote'     : 'exitSkipNote'

  const updated = await prisma.serviceSection.update({
    where: { id: section.id },
    data: {
      [skipAt]:   new Date(),
      [skipNote]: note?.trim() || `Пропуснато от ${session.user.name ?? 'Unknown'}`,
    },
  })

  return NextResponse.json({
    section: {
      ...updated,
      intakeSkippedAt: updated.intakeSkippedAt?.toISOString() ?? null,
      exitSkippedAt:   updated.exitSkippedAt?.toISOString()   ?? null,
    },
  })
}
