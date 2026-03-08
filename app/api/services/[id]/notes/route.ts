import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// POST /api/services/[id]/notes
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'note.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const serviceId = Number(id)

  const service = await prisma.serviceOrder.findUnique({ where: { id: serviceId } })
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { content } = await request.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Въведете съдържание.' }, { status: 422 })
  if (content.trim().length > 5000) return NextResponse.json({ error: 'Бележката не може да надвишава 5000 знака.' }, { status: 422 })

  const note = await prisma.note.create({
    data: {
      serviceOrderId:  serviceId,
      content:         content.trim(),
      userId:          Number(session.user.id),
      userNameSnapshot: session.user.name ?? 'Unknown',
    },
  })

  return NextResponse.json({ note: { ...note, createdAt: note.createdAt.toISOString() } }, { status: 201 })
}
