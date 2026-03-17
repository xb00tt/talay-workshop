import { describe, it, expect } from 'vitest'
import {
  fmtDate,
  canDeleteSection,
  resolvedStageState,
} from '@/app/(app)/services/[id]/helpers'

// ─── fmtDate ─────────────────────────────────────────────────────────────────

describe('fmtDate', () => {
  it('formats an ISO date string as DD.MM.YYYY', () => {
    expect(fmtDate('2024-06-15T00:00:00.000Z')).toBe('15.06.2024')
    expect(fmtDate('2024-12-31T00:00:00.000Z')).toBe('31.12.2024')
  })

  it('pads single-digit days and months with leading zeros', () => {
    expect(fmtDate('2024-01-05T00:00:00.000Z')).toBe('05.01.2024')
    expect(fmtDate('2024-09-01T00:00:00.000Z')).toBe('01.09.2024')
  })
})

// ─── resolvedStageState ──────────────────────────────────────────────────────

describe('resolvedStageState', () => {
  it('returns done for SCHEDULED and locked for all others when CANCELLED', () => {
    expect(resolvedStageState('SCHEDULED', 'CANCELLED')).toBe('done')
    expect(resolvedStageState('INTAKE', 'CANCELLED')).toBe('locked')
    expect(resolvedStageState('IN_PROGRESS', 'CANCELLED')).toBe('locked')
    expect(resolvedStageState('READY', 'CANCELLED')).toBe('locked')
    expect(resolvedStageState('COMPLETED', 'CANCELLED')).toBe('locked')
  })

  it('returns done when stage is before current', () => {
    expect(resolvedStageState('SCHEDULED', 'IN_PROGRESS')).toBe('done')
    expect(resolvedStageState('INTAKE', 'IN_PROGRESS')).toBe('done')
  })

  it('returns active when stage equals current', () => {
    expect(resolvedStageState('IN_PROGRESS', 'IN_PROGRESS')).toBe('active')
    expect(resolvedStageState('SCHEDULED', 'SCHEDULED')).toBe('active')
    expect(resolvedStageState('COMPLETED', 'COMPLETED')).toBe('active')
  })

  it('returns locked when stage is after current', () => {
    expect(resolvedStageState('READY', 'INTAKE')).toBe('locked')
    expect(resolvedStageState('COMPLETED', 'IN_PROGRESS')).toBe('locked')
  })

  it('returns done for SCHEDULED when current is COMPLETED', () => {
    expect(resolvedStageState('SCHEDULED', 'COMPLETED')).toBe('done')
  })
})

// ─── canDeleteSection ────────────────────────────────────────────────────────

describe('canDeleteSection', () => {
  it('returns false for CHECKLIST type regardless of work cards', () => {
    expect(canDeleteSection({ type: 'CHECKLIST', workCards: [] } as any)).toBe(false)
  })

  it('returns false for EQUIPMENT_CHECK type regardless of work cards', () => {
    expect(canDeleteSection({ type: 'EQUIPMENT_CHECK', workCards: [] } as any)).toBe(false)
  })

  it('returns false when a work card is IN_PROGRESS', () => {
    const sec = {
      type: 'MID_SERVICE',
      workCards: [{ status: 'IN_PROGRESS' }],
    }
    expect(canDeleteSection(sec as any)).toBe(false)
  })

  it('returns false when a work card is COMPLETED', () => {
    const sec = {
      type: 'MID_SERVICE',
      workCards: [{ status: 'COMPLETED' }],
    }
    expect(canDeleteSection(sec as any)).toBe(false)
  })

  it('returns true when all work cards are PENDING', () => {
    const sec = {
      type: 'MID_SERVICE',
      workCards: [{ status: 'PENDING' }, { status: 'PENDING' }],
    }
    expect(canDeleteSection(sec as any)).toBe(true)
  })

  it('returns true when work cards are only PENDING and CANCELLED', () => {
    const sec = {
      type: 'MID_SERVICE',
      workCards: [{ status: 'PENDING' }, { status: 'CANCELLED' }],
    }
    expect(canDeleteSection(sec as any)).toBe(true)
  })

  it('returns true when there are no work cards', () => {
    const sec = { type: 'MID_SERVICE', workCards: [] }
    expect(canDeleteSection(sec as any)).toBe(true)
  })
})
