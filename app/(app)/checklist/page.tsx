import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import ChecklistClient from './ChecklistClient'

export default async function ChecklistPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { role, permissions } = session.user
  const canEdit = hasPermission(role, permissions, 'checklist.edit')

  const items = await prisma.checklistTemplate.findMany({ orderBy: { order: 'asc' } })

  return (
    <ChecklistClient
      initialItems={items.map((i) => ({ ...i }))}
      canEdit={canEdit}
    />
  )
}
