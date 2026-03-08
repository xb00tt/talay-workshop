import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SetupWizard from './SetupWizard'

export default async function SetupPage() {
  const userCount = await prisma.user.count()
  if (userCount > 0) redirect('/login')

  return <SetupWizard />
}
