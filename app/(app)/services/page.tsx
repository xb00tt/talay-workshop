import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import ServicesClient from './ServicesClient'

export default async function ServicesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { role, permissions } = session.user
  const pageSize = session.user.pageSize ?? 10

  const activeWhere = { status: { notIn: ['COMPLETED', 'CANCELLED'] as never[] } }

  const [services, total, trucks] = await Promise.all([
    prisma.serviceOrder.findMany({
      where:   activeWhere,
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
      take:    pageSize,
      include: { truck: { select: { make: true, model: true } } },
    }),
    prisma.serviceOrder.count({ where: activeWhere }),
    prisma.truck.findMany({ orderBy: { plateNumber: 'asc' } }),
  ])

  return (
    <ServicesClient
      initialServices={services.map((s) => ({
        ...s,
        scheduledDate: s.scheduledDate.toISOString(),
        createdAt:     s.createdAt.toISOString(),
      }))}
      initialTotal={total}
      initialPageSize={pageSize}
      trucks={trucks}
      canCreate={hasPermission(role, permissions, 'service.create')}
      canReschedule={hasPermission(role, permissions, 'service.reschedule')}
    />
  )
}
