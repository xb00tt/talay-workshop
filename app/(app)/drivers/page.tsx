import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import DriversClient from './DriversClient'

export default async function DriversPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const drivers = await prisma.driver.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  })

  return (
    <DriversClient
      initialDrivers={drivers}
      isManager={session.user.role === 'MANAGER'}
    />
  )
}
