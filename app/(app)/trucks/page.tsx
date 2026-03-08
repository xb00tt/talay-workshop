import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { enrichTrucks } from '@/lib/truck-enrichment'
import TrucksClient from './TrucksClient'

export default async function TrucksPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { role, permissions } = session.user
  const trucks = await prisma.truck.findMany({ orderBy: { plateNumber: 'asc' } })
  const enriched = await enrichTrucks(trucks)

  return (
    <TrucksClient
      initialTrucks={enriched}
      pageSize={session.user.pageSize ?? 10}
      canCreate={hasPermission(role, permissions, 'truck.create')}
      canEdit={hasPermission(role, permissions, 'truck.edit')}
      canDeactivate={hasPermission(role, permissions, 'truck.deactivate')}
      canImport={hasPermission(role, permissions, 'truck.import')}
    />
  )
}
