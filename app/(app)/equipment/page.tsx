import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import EquipmentClient from './EquipmentClient'

export default async function EquipmentPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { role, permissions } = session.user
  const canEdit = hasPermission(role, permissions, 'equipment.edit')

  const [items, adrItems] = await Promise.all([
    prisma.equipmentItem.findMany({ orderBy: { order: 'asc' } }),
    prisma.adrEquipmentItem.findMany({ orderBy: { order: 'asc' } }),
  ])

  return (
    <EquipmentClient
      initialItems={items.map((i) => ({ ...i }))}
      initialAdrItems={adrItems.map((i) => ({ ...i }))}
      canEdit={canEdit}
    />
  )
}
