import { NextIntlClientProvider } from 'next-intl'
import getRequestConfig from '@/i18n/request'

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const { locale, messages } = await (getRequestConfig as Function)()

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
