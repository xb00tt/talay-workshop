import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        })
        if (!user) return null

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        return {
          id: String(user.id),
          name: user.name,
          username: user.username,
          role: user.role,
          permissions: JSON.parse(user.permissions) as string[],
          preferredLocale: user.preferredLocale,
          darkMode: user.darkMode,
          pageSize: user.pageSize,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60,   // 1 hour
    updateAge: 0,       // Rolling: extend on every request
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = (user as any).username
        token.role = (user as any).role
        token.permissions = (user as any).permissions
        token.preferredLocale = (user as any).preferredLocale
        token.darkMode = (user as any).darkMode
        token.pageSize = (user as any).pageSize
      } else if (token.id) {
        // Re-read mutable preferences from DB on every refresh so changes
        // made in Settings take effect on the next navigation, not next login.
        const fresh = await prisma.user.findUnique({
          where:  { id: Number(token.id) },
          select: { preferredLocale: true, darkMode: true, pageSize: true, permissions: true },
        })
        if (fresh) {
          token.preferredLocale = fresh.preferredLocale
          token.darkMode        = fresh.darkMode
          token.pageSize        = fresh.pageSize
          token.permissions     = JSON.parse(fresh.permissions) as string[]
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.username = token.username as string
      session.user.role = token.role as string
      session.user.permissions = token.permissions as string[]
      session.user.preferredLocale = token.preferredLocale as string
      session.user.darkMode = token.darkMode as boolean
      session.user.pageSize = token.pageSize as number
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
