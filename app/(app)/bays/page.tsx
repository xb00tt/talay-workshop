import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import BaysClient from './BaysClient'

export default async function BaysPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const canManage = hasPermission(session.user.role, session.user.permissions, 'bay.manage')
  const bays = await prisma.bay.findMany({ orderBy: { id: 'asc' } })

  return <BaysClient initialBays={bays} canManage={canManage} />
}
