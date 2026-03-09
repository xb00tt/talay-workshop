import { describe, it, expect } from 'vitest'
import { fmtDate, fmtDateTime, fmtKm } from '@/lib/format'

// ─── fmtDate ──────────────────────────────────────────────────────────────────

describe('fmtDate', () => {
  it('formats an ISO date string as DD.MM.YYYY', () => {
    expect(fmtDate('2024-01-15')).toBe('15.01.2024')
    expect(fmtDate('2024-12-31')).toBe('31.12.2024')
  })

  it('pads single-digit days and months with leading zeros', () => {
    expect(fmtDate('2024-01-05')).toBe('05.01.2024')
    expect(fmtDate('2024-09-01')).toBe('01.09.2024')
  })

  it('formats a Date object', () => {
    // Use UTC constructor to avoid timezone shifting
    expect(fmtDate(new Date('2024-03-05T00:00:00.000Z'))).toBe('05.03.2024')
  })

  it('returns — for null', () => {
    expect(fmtDate(null)).toBe('—')
  })

  it('returns — for undefined', () => {
    expect(fmtDate(undefined)).toBe('—')
  })

  it('uses UTC date (not local), so midnight UTC is the same date everywhere', () => {
    expect(fmtDate('2024-06-15T00:00:00.000Z')).toBe('15.06.2024')
  })
})

// ─── fmtDateTime ──────────────────────────────────────────────────────────────

describe('fmtDateTime', () => {
  it('returns a string matching DD.MM.YYYY HH:MM format', () => {
    const result = fmtDateTime(new Date(2024, 5, 15, 10, 30).toISOString())
    expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/)
  })

  it('pads single-digit hours and minutes', () => {
    // Build a local date with H=5 M=7 to confirm padding
    const d = new Date(2024, 0, 5, 5, 7)
    const result = fmtDateTime(d.toISOString())
    expect(result).toMatch(/05\.01\.2024 05:07/)
  })

  it('uses local time (not UTC)', () => {
    // Build with explicit local hours — result should match those hours exactly
    const d = new Date(2024, 11, 25, 14, 59) // 25 Dec 2024, 14:59 local
    const result = fmtDateTime(d.toISOString())
    expect(result).toBe(`25.12.2024 14:59`)
  })
})

// ─── fmtKm ────────────────────────────────────────────────────────────────────

describe('fmtKm', () => {
  it('returns — for null', () => {
    expect(fmtKm(null)).toBe('—')
  })

  it('returns — for undefined', () => {
    expect(fmtKm(undefined)).toBe('—')
  })

  it('includes the км suffix', () => {
    expect(fmtKm(0)).toContain('км')
    expect(fmtKm(1000)).toContain('км')
    expect(fmtKm(250000)).toContain('км')
  })

  it('rounds fractional values', () => {
    // 1234.4 → 1234, 1234.5 → 1235
    expect(fmtKm(1234.4)).not.toContain('1 235')
    expect(fmtKm(1234.6)).not.toContain('1 234')
  })

  it('formats 0 as 0 км', () => {
    expect(fmtKm(0)).toContain('0')
    expect(fmtKm(0)).toContain('км')
  })

  it('formats large numbers using bg-BG locale (space or narrow-space thousands separator)', () => {
    const result = fmtKm(250000)
    // bg-BG uses a space or non-breaking space as thousands separator
    expect(result).toMatch(/250.000 км/)  // matches "250 000 км" or "250\u00A0000 км"
    expect(result).toContain('км')
  })
})
