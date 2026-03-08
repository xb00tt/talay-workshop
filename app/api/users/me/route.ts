import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/users/me — update current user's personal preferences
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { preferredLocale, darkMode, pageSize } = body

  const data: Record<string, unknown> = {}
  if (preferredLocale !== undefined) data.preferredLocale = preferredLocale
  if (darkMode        !== undefined) data.darkMode        = Boolean(darkMode)
  if (pageSize        !== undefined) data.pageSize        = Number(pageSize)

  await prisma.user.update({ where: { id: Number(session.user.id) }, data })

  return NextResponse.json({ ok: true })
}
