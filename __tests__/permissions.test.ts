import { describe, it, expect } from 'vitest'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'

describe('hasPermission', () => {
  describe('MANAGER role', () => {
    it('grants every permission regardless of permissions array', () => {
      for (const action of Object.values(PERMISSIONS)) {
        expect(hasPermission('MANAGER', [], action)).toBe(true)
      }
    })

    it('grants permission even with empty permissions array', () => {
      expect(hasPermission('MANAGER', [], 'service.create')).toBe(true)
    })
  })

  describe('ASSISTANT role', () => {
    it('grants permission when action is in the permissions array', () => {
      expect(hasPermission('ASSISTANT', ['service.create', 'truck.edit'], 'service.create')).toBe(true)
      expect(hasPermission('ASSISTANT', ['service.create', 'truck.edit'], 'truck.edit')).toBe(true)
    })

    it('denies permission when action is not in the permissions array', () => {
      expect(hasPermission('ASSISTANT', ['service.create'], 'service.cancel')).toBe(false)
    })

    it('denies all permissions with empty array', () => {
      for (const action of Object.values(PERMISSIONS)) {
        expect(hasPermission('ASSISTANT', [], action)).toBe(false)
      }
    })

    it('grants all 21 permissions when all are explicitly listed', () => {
      const all = Object.values(PERMISSIONS)
      for (const action of all) {
        expect(hasPermission('ASSISTANT', all, action)).toBe(true)
      }
    })
  })

  describe('PERMISSIONS constant', () => {
    it('contains all 21 expected actions', () => {
      expect(Object.keys(PERMISSIONS)).toHaveLength(21)
    })

    it('all values are dot-separated strings', () => {
      for (const value of Object.values(PERMISSIONS)) {
        expect(value).toMatch(/^[a-z]+\.[a-z]+$/)
      }
    })
  })
})
