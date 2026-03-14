import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import AuditLogClient from '@/app/(app)/audit-log/AuditLogClient'

export default async function AdminAuditLogPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  return <AuditLogClient />
}
