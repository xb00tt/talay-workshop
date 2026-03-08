import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import CalendarClient from './CalendarClient'

export default async function CalendarPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { role, permissions } = session.user
  const canCreate = hasPermission(role, permissions, 'service.create')

  // Fetch all services with date info — client filters by visible month
  const services = await prisma.serviceOrder.findMany({
    select: {
      id: true,
      truckPlateSnapshot: true,
      status: true,
      scheduledDate: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { scheduledDate: 'asc' },
  })

  const trucks = canCreate
    ? await prisma.truck.findMany({
        where:   { isActive: true },
        select:  { id: true, plateNumber: true, make: true, model: true },
        orderBy: { plateNumber: 'asc' },
      })
    : []

  return (
    <CalendarClient
      initialServices={services.map((s: (typeof services)[number]) => ({
        ...s,
        scheduledDate: s.scheduledDate.toISOString().slice(0, 10),
        startDate:     s.startDate?.toISOString().slice(0, 10) ?? null,
        endDate:       s.endDate?.toISOString().slice(0, 10) ?? null,
      }))}
      trucks={trucks}
      canCreate={canCreate}
    />
  )
}
