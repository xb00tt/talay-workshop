import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')

  const userCount = await prisma.user.count()
  if (userCount === 0) redirect('/setup')

  const settings = await prisma.settings.findUnique({ where: { id: 1 } })

  return <LoginForm companyName={settings?.companyName ?? ''} />
}
