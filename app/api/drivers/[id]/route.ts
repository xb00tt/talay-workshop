import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/drivers/[id] — toggle isActive
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const driverId = Number(id)
  if (isNaN(driverId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const driver = await prisma.driver.findUnique({ where: { id: driverId } })
  if (!driver) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { isActive } = await request.json()
  const updated = await prisma.driver.update({
    where: { id: driverId },
    data: { isActive: Boolean(isActive) },
  })

  return NextResponse.json({ driver: updated })
}
