import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { authOptions } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import getRequestConfig from '@/i18n/request'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { locale, messages } = await (getRequestConfig as Function)()

  const darkMode = session.user.darkMode !== false

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className={darkMode ? 'dark' : ''}>
        <div className="bg-gray-950 text-gray-100 min-h-screen">
          <AppShell userName={session.user.name ?? ''} userRole={session.user.role}>
            {children}
          </AppShell>
        </div>
      </div>
    </NextIntlClientProvider>
  )
}
