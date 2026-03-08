import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SessionProviderWrapper from '@/components/SessionProviderWrapper'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'Talay Workshop',
  description: 'Workshop management for Talay Transport',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  )
}
