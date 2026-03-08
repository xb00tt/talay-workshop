import { describe, it, expect } from 'vitest'
import { auditActor } from '@/lib/audit'

describe('auditActor', () => {
  it('extracts userId and name from a valid session', () => {
    const session = { user: { id: '42', name: 'Maria Ivanova' } }
    expect(auditActor(session)).toEqual({ userId: 42, userNameSnapshot: 'Maria Ivanova' })
  })

  it('converts string id to number', () => {
    const session = { user: { id: '7', name: 'Test' } }
    expect(auditActor(session).userId).toBe(7)
  })

  it('returns null userId when session is null', () => {
    expect(auditActor(null)).toEqual({ userId: null, userNameSnapshot: 'Unknown' })
  })

  it('returns null userId when session is undefined', () => {
    expect(auditActor(undefined)).toEqual({ userId: null, userNameSnapshot: 'Unknown' })
  })

  it('returns null userId when user.id is missing', () => {
    const session = { user: { name: 'No ID User' } }
    expect(auditActor(session)).toEqual({ userId: null, userNameSnapshot: 'No ID User' })
  })

  it('falls back to "Unknown" when user.name is missing', () => {
    const session = { user: { id: '1' } }
    expect(auditActor(session)).toEqual({ userId: 1, userNameSnapshot: 'Unknown' })
  })
})
