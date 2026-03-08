import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      username: string
      role: string
      permissions: string[]
      preferredLocale: string
      darkMode: boolean
      pageSize: number
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    username: string
    role: string
    permissions: string[]
    preferredLocale: string
    darkMode: boolean
    pageSize: number
  }
}
