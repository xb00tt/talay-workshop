import { getRequestConfig } from 'next-intl/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default getRequestConfig(async () => {
  const session = await getServerSession(authOptions)
  const locale = (session?.user?.preferredLocale as string | undefined) ?? 'bg'

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
