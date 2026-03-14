import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AdminSettingsClient from './AdminSettingsClient'

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  const s = await prisma.settings.findUnique({ where: { id: 1 } })

  const settings = {
    companyName:     s?.companyName     ?? '',
    companyAddress:  s?.companyAddress  ?? '',
    logoPath:        s?.logoPath        ?? null,
    frotcomUsername: s?.frotcomUsername ?? '',
    frotcomPassword: s?.frotcomPassword ?? '',
  }

  return <AdminSettingsClient settings={settings} />
}
