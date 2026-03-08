import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import MechanicsClient from './MechanicsClient'

export default async function MechanicsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const canManage  = hasPermission(session.user.role, session.user.permissions, 'mechanic.manage')
  const mechanics  = await prisma.mechanic.findMany({ orderBy: { name: 'asc' } })

  return <MechanicsClient initialMechanics={mechanics} canManage={canManage} />
}
