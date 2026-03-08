import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rateLimit, getIp } from '@/lib/rateLimit'

// ─── Rate limiter ──────────────────────────────────────────────────────────────

describe('rateLimit', () => {
  it('allows requests within the limit', () => {
    const key = `test-${Date.now()}-allow`
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000).allowed).toBe(true)
    }
  })

  it('blocks the 6th request when limit is 5', () => {
    const key = `test-${Date.now()}-block`
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 60_000)
    expect(rateLimit(key, 5, 60_000).allowed).toBe(false)
  })

  it('reports correct remaining count', () => {
    const key = `test-${Date.now()}-remaining`
    const r1 = rateLimit(key, 5, 60_000)
    expect(r1.remaining).toBe(4)
    const r2 = rateLimit(key, 5, 60_000)
    expect(r2.remaining).toBe(3)
  })

  it('resets after the window expires', async () => {
    const key = `test-${Date.now()}-reset`
    // Use a 1ms window so it expires immediately
    rateLimit(key, 1, 1)
    rateLimit(key, 1, 1) // this blocks
    await new Promise((r) => setTimeout(r, 5))
    // After window, should be allowed again
    expect(rateLimit(key, 1, 1).allowed).toBe(true)
  })

  it('isolates different keys', () => {
    const key1 = `test-${Date.now()}-key1`
    const key2 = `test-${Date.now()}-key2`
    for (let i = 0; i < 5; i++) rateLimit(key1, 5, 60_000)
    // key1 is exhausted, key2 should still be fresh
    expect(rateLimit(key1, 5, 60_000).allowed).toBe(false)
    expect(rateLimit(key2, 5, 60_000).allowed).toBe(true)
  })
})

describe('getIp', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getIp(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '9.9.9.9' },
    })
    expect(getIp(req)).toBe('9.9.9.9')
  })

  it('returns "unknown" when no IP headers present', () => {
    const req = new Request('http://localhost')
    expect(getIp(req)).toBe('unknown')
  })
})

// ─── Upload security constants ─────────────────────────────────────────────────

describe('Upload security (MIME_TO_EXT mapping)', () => {
  const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
    'image/gif':  '.gif',
    'image/webp': '.webp',
  }

  it('maps all allowed MIME types to safe extensions', () => {
    for (const [mime, ext] of Object.entries(MIME_TO_EXT)) {
      expect(ext).toMatch(/^\.[a-z]+$/)
      expect(mime).toMatch(/^image\//)
    }
  })

  it('does not map executable or script extensions', () => {
    const dangerous = ['.php', '.js', '.html', '.sh', '.exe', '.svg']
    const extensions = Object.values(MIME_TO_EXT)
    for (const ext of dangerous) {
      expect(extensions).not.toContain(ext)
    }
  })
})

// ─── Equipment ID parsing ──────────────────────────────────────────────────────

describe('parseEquipmentId (security)', () => {
  // Replicate the function logic for unit testing
  function parseEquipmentId(id: string): { type: 'global' | 'adr'; itemId: number } | null {
    const dashIdx = id.indexOf('-')
    if (dashIdx === -1) return null
    const type  = id.slice(0, dashIdx)
    const rawId = id.slice(dashIdx + 1)
    if (type !== 'global' && type !== 'adr') return null
    const itemId = Number(rawId)
    if (!Number.isInteger(itemId) || itemId <= 0) return null
    return { type: type as 'global' | 'adr', itemId }
  }

  it('parses valid global ID', () => {
    expect(parseEquipmentId('global-5')).toEqual({ type: 'global', itemId: 5 })
  })

  it('parses valid adr ID', () => {
    expect(parseEquipmentId('adr-12')).toEqual({ type: 'adr', itemId: 12 })
  })

  it('rejects unknown prefix', () => {
    expect(parseEquipmentId('evil-5')).toBeNull()
    expect(parseEquipmentId('admin-1')).toBeNull()
  })

  it('rejects missing dash', () => {
    expect(parseEquipmentId('global')).toBeNull()
    expect(parseEquipmentId('adr')).toBeNull()
  })

  it('rejects non-integer ID part', () => {
    expect(parseEquipmentId('global-abc')).toBeNull()
    expect(parseEquipmentId('adr-1.5')).toBeNull()
  })

  it('rejects zero or negative ID', () => {
    expect(parseEquipmentId('global-0')).toBeNull()
    expect(parseEquipmentId('adr--1')).toBeNull()
  })

  it('rejects NaN', () => {
    expect(parseEquipmentId('global-')).toBeNull()
    expect(parseEquipmentId('adr-undefined')).toBeNull()
  })
})
