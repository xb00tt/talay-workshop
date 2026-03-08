import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import AuditLogClient from './AuditLogClient'

export default async function AuditLogPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  // Only managers can view audit log
  if (session.user.role !== 'MANAGER') redirect('/dashboard')

  return <AuditLogClient />
}
