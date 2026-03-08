import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// POST /api/users/[id]/reset-password — manager resets any user's password
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'user.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const userId = Number(id)
  if (isNaN(userId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Generate a new random password + new recovery code
  const tempPassword = crypto.randomBytes(8).toString('hex')
  const recoveryCode = crypto.randomBytes(6).toString('hex').toUpperCase()
  const passwordHash = await bcrypt.hash(tempPassword, 12)

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, recoveryCode },
  })

  return NextResponse.json({ tempPassword, recoveryCode })
}
