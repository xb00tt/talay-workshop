import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import UsersClient from '@/app/(app)/users/UsersClient'

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      permissions: true,
      preferredLocale: true,
      darkMode: true,
      pageSize: true,
      createdAt: true,
    },
  })

  return (
    <UsersClient
      initialUsers={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      currentUserId={Number(session.user.id)}
      pageSize={session.user.pageSize ?? 10}
    />
  )
}
