import { describe, it, expect } from 'vitest'
import { cleanDriverName } from '@/lib/frotcom'

describe('cleanDriverName', () => {
  it('returns the name as-is for clean input', () => {
    expect(cleanDriverName('Ivan Petrov')).toBe('Ivan Petrov')
    expect(cleanDriverName('Georgi Ivanov')).toBe('Georgi Ivanov')
  })

  it('strips leading asterisks', () => {
    expect(cleanDriverName('*John Doe')).toBe('John Doe')
    expect(cleanDriverName('**Jane Smith')).toBe('Jane Smith')
    expect(cleanDriverName('***Triple Star')).toBe('Triple Star')
  })

  it('strips asterisks and then trims whitespace', () => {
    expect(cleanDriverName('*  Spaced Name  ')).toBe('Spaced Name')
  })

  it('returns null for names starting with a digit (junk card entries)', () => {
    expect(cleanDriverName('123abc')).toBeNull()
    expect(cleanDriverName('0 Driver')).toBeNull()
    expect(cleanDriverName('*9SomeJunk')).toBeNull()
  })

  it('returns null for names containing "created by" (case-insensitive)', () => {
    expect(cleanDriverName('Created by App')).toBeNull()
    expect(cleanDriverName('CREATED BY SYSTEM')).toBeNull()
    expect(cleanDriverName('auto created by driver')).toBeNull()
  })

  it('returns null for empty string after stripping asterisks', () => {
    expect(cleanDriverName('')).toBeNull()
    expect(cleanDriverName('***')).toBeNull()
    expect(cleanDriverName('*   ')).toBeNull()
  })

  it('preserves names that contain digits but do not start with one', () => {
    expect(cleanDriverName('Driver 007')).toBe('Driver 007')
    expect(cleanDriverName('Ivan2')).toBe('Ivan2')
  })
})
