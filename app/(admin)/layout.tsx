import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { authOptions } from '@/lib/auth'
import AdminShell from '@/components/AdminShell'
import getRequestConfig from '@/i18n/request'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  const { locale, messages } = await (getRequestConfig as Function)()

  const darkMode = session.user.darkMode === true

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className={darkMode ? 'dark' : ''}>
        <div className="bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 min-h-screen">
          <AdminShell userName={session.user.name ?? ''}>
            {children}
          </AdminShell>
        </div>
      </div>
    </NextIntlClientProvider>
  )
}
