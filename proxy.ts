import { auth } from "@/auth";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n/routing";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

// Routes that don't require authentication
const PUBLIC_PATHS = ["/login", "/api/auth"];

export default auth(async function middleware(
  request: NextRequest & { auth: Awaited<ReturnType<typeof auth>> }
) {
  const { pathname } = request.nextUrl;

  // Pass auth API calls through
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Check authentication for protected routes
  const session = request.auth;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!session && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Run intl middleware for all routes (adds locale prefix handling)
  return intlMiddleware(request);
});

export const config = {
  // Match all paths except static assets and Next internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads).*)"],
};
