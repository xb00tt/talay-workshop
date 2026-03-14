import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { authOptions } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import getRequestConfig from '@/i18n/request'
import { prisma } from '@/lib/prisma'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { locale, messages } = await (getRequestConfig as Function)()

  const darkMode = session.user.darkMode === true

  const [activeServiceCount, truckCount, settings] = await Promise.all([
    prisma.serviceOrder.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.truck.count({ where: { isActive: true } }),
    prisma.settings.findUnique({ where: { id: 1 }, select: { companyName: true } }),
  ])

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className={darkMode ? 'dark' : ''}>
        <div className="bg-[#eef2f7] text-gray-900 dark:bg-gray-950 dark:text-gray-100 min-h-screen">
          <AppShell
            userName={session.user.name ?? ''}
            userRole={session.user.role}
            preferredLocale={session.user.preferredLocale ?? 'bg'}
            darkMode={darkMode}
            pageSize={session.user.pageSize ?? 10}
            activeServiceCount={activeServiceCount}
            truckCount={truckCount}
            companyName={settings?.companyName ?? undefined}
          >
            {children}
          </AppShell>
        </div>
      </div>
    </NextIntlClientProvider>
  )
}
