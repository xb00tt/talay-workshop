import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import ReportsClient from './ReportsClient'

export default async function ReportsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { role, permissions } = session.user
  if (!hasPermission(role, permissions, 'report.view')) redirect('/dashboard')

  const canExport = hasPermission(role, permissions, 'report.export')
  const trucks = await prisma.truck.findMany({
    select: { id: true, plateNumber: true, make: true, model: true },
    orderBy: { plateNumber: 'asc' },
  })

  return <ReportsClient trucks={trucks} canExport={canExport} />
}
