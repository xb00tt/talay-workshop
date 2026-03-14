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

  const [services, total, trucks, statusGroups] = await Promise.all([
    prisma.serviceOrder.findMany({
      where:   activeWhere,
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
      take:    pageSize,
      include: {
        truck:    { select: { make: true, model: true, isAdr: true, year: true, currentMileage: true } },
        sections: { select: { workCards: { select: { status: true, mechanicName: true } } } },
      },
    }),
    prisma.serviceOrder.count({ where: activeWhere }),
    prisma.truck.findMany({ orderBy: { plateNumber: 'asc' } }),
    prisma.serviceOrder.groupBy({ by: ['status'], _count: { _all: true } }),
  ])

  const statusCounts = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])) as Record<string, number>

  return (
    <ServicesClient
      initialServices={services.map((s) => ({
        ...s,
        scheduledDate: s.scheduledDate.toISOString(),
        startDate:     s.startDate?.toISOString() ?? null,
        endDate:       s.endDate?.toISOString()   ?? null,
        createdAt:     s.createdAt.toISOString(),
      }))}
      initialTotal={total}
      initialPageSize={pageSize}
      trucks={trucks}
      statusCounts={statusCounts}
      canCreate={hasPermission(role, permissions, 'service.create')}
      canReschedule={hasPermission(role, permissions, 'service.reschedule')}
    />
  )
}
