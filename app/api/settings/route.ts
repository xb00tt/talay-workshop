import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { logAudit, auditActor } from '@/lib/audit'

// GET /api/settings
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await prisma.settings.findUnique({ where: { id: 1 } })
  const canEdit = hasPermission(session.user.role, session.user.permissions, 'settings.edit')

  return NextResponse.json({
    settings: {
      companyName:    settings?.companyName    ?? '',
      companyAddress: settings?.companyAddress ?? '',
      logoPath:       settings?.logoPath       ?? null,
      ...(canEdit && {
        frotcomUsername: settings?.frotcomUsername ?? '',
        frotcomPassword: settings?.frotcomPassword ?? '',
      }),
    },
    canEdit,
  })
}

// PATCH /api/settings
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'settings.edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { companyName, companyAddress, frotcomUsername, frotcomPassword } = body

  const data: Record<string, string> = {}
  if (companyName    !== undefined) data.companyName    = companyName.trim()
  if (companyAddress !== undefined) data.companyAddress = companyAddress.trim()
  if (frotcomUsername !== undefined) data.frotcomUsername = frotcomUsername.trim()
  if (frotcomPassword !== undefined) data.frotcomPassword = frotcomPassword

  const settings = await prisma.settings.update({ where: { id: 1 }, data })
  await logAudit({
    ...auditActor(session),
    action:     'settings.update',
    entityType: 'Settings',
    entityId:   1,
    newValue:   { companyName: settings.companyName, companyAddress: settings.companyAddress },
  })
  return NextResponse.json({ settings })
}
