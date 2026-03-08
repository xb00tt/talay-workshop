/**
 * Simple in-memory rate limiter.
 * Suitable for a single-instance server (this workshop app runs on one machine).
 * Keyed by arbitrary string (e.g. IP address + endpoint).
 */

interface Window {
  count:    number
  resetAt:  number  // ms timestamp
}

const store = new Map<string, Window>()

/**
 * Check and record an attempt.
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function rateLimit(
  key:       string,
  maxAttempts: number,
  windowMs:  number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  let win   = store.get(key)

  if (!win || win.resetAt <= now) {
    win = { count: 0, resetAt: now + windowMs }
    store.set(key, win)
  }

  win.count++
  const allowed   = win.count <= maxAttempts
  const remaining = Math.max(0, maxAttempts - win.count)

  return { allowed, remaining, resetAt: win.resetAt }
}

/** Extract IP from a Next.js Request */
export function getIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}
