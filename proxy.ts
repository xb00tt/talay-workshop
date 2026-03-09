import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default withAuth(
  function middleware(req: NextRequest) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
)

export const config = {
  // Protect everything except: /login, /setup, NextAuth API, setup API, recovery API, static files
  matcher: [
    '/((?!login|setup|api/auth|api/setup|_next/static|_next/image|favicon.ico|uploads).*)',
  ],
}
