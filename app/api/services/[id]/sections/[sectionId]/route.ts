import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string; sectionId: string }> }

// DELETE /api/services/[id]/sections/[sectionId]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'service.create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, sectionId } = await params
  const serviceId = Number(id)
  const secId     = Number(sectionId)

  const section = await prisma.serviceSection.findFirst({
    where: { id: secId, serviceOrderId: serviceId },
    include: { workCards: true },
  })
  if (!section) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (section.type === 'CHECKLIST' || section.type === 'EQUIPMENT_CHECK') {
    return NextResponse.json({ error: 'Системните раздели не могат да се изтриват.' }, { status: 422 })
  }

  const hasWork = section.workCards.some(
    (wc) => wc.status !== 'PENDING' && wc.status !== 'CANCELLED',
  )
  if (hasWork) {
    return NextResponse.json({ error: 'Разделът съдържа работни карти в процес.' }, { status: 422 })
  }

  await prisma.serviceSection.delete({ where: { id: secId } })
  return NextResponse.json({ success: true })
}
