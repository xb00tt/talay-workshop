import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const canEdit = hasPermission(session.user.role, session.user.permissions, 'settings.edit')
  const s = await prisma.settings.findUnique({ where: { id: 1 } })

  const settings = {
    companyName:     s?.companyName     ?? '',
    companyAddress:  s?.companyAddress  ?? '',
    logoPath:        s?.logoPath        ?? null,
    ...(canEdit && {
      frotcomUsername: s?.frotcomUsername ?? '',
      frotcomPassword: s?.frotcomPassword ?? '',
    }),
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
    select: { preferredLocale: true, darkMode: true, pageSize: true },
  })

  return (
    <SettingsClient
      settings={settings}
      canEdit={canEdit}
      currentUser={{
        preferredLocale: user?.preferredLocale ?? 'bg',
        darkMode:        user?.darkMode        ?? true,
        pageSize:        user?.pageSize        ?? 10,
      }}
    />
  )
}
