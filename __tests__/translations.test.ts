import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const bg = JSON.parse(fs.readFileSync(path.resolve('messages/bg.json'), 'utf8'))
const en = JSON.parse(fs.readFileSync(path.resolve('messages/en.json'), 'utf8'))

interface Leaf { path: string[]; value: unknown }

/** Collect all leaf nodes with their key-path arrays (avoids dot-key ambiguity). */
function collectLeaves(obj: Record<string, unknown>, path: string[] = []): Leaf[] {
  return Object.entries(obj).flatMap(([key, val]) => {
    const next = [...path, key]
    if (val !== null && typeof val === 'object' && !Array.isArray(val))
      return collectLeaves(val as Record<string, unknown>, next)
    return [{ path: next, value: val }]
  })
}

// Use null-byte as separator so literal-dot keys (e.g. perm["service.create"]) don't collide.
const SEP = '\0'
const bgLeaves = collectLeaves(bg)
const enLeaves = collectLeaves(en)
const bgKeys   = new Set(bgLeaves.map((l) => l.path.join(SEP)))
const enKeys   = new Set(enLeaves.map((l) => l.path.join(SEP)))

function friendlyKey(l: Leaf) { return l.path.join('.') }

describe('Translation key parity (bg ↔ en)', () => {
  it('every key in bg.json exists in en.json', () => {
    const missing = bgLeaves.filter((l) => !enKeys.has(l.path.join(SEP))).map(friendlyKey)
    expect(missing, `Keys in bg but not en:\n${missing.join('\n')}`).toHaveLength(0)
  })

  it('every key in en.json exists in bg.json', () => {
    const missing = enLeaves.filter((l) => !bgKeys.has(l.path.join(SEP))).map(friendlyKey)
    expect(missing, `Keys in en but not bg:\n${missing.join('\n')}`).toHaveLength(0)
  })

  it('both files have more than 100 translation keys', () => {
    expect(bgLeaves.length).toBeGreaterThan(100)
    expect(enLeaves.length).toBeGreaterThan(100)
  })

  it('no translation key has an empty string value in bg.json', () => {
    const empty = bgLeaves.filter((l) => l.value === '').map(friendlyKey)
    expect(empty, `Empty bg keys:\n${empty.join('\n')}`).toHaveLength(0)
  })

  it('no translation key has an empty string value in en.json', () => {
    const empty = enLeaves.filter((l) => l.value === '').map(friendlyKey)
    expect(empty, `Empty en keys:\n${empty.join('\n')}`).toHaveLength(0)
  })
})

describe('Translation namespaces', () => {
  const expectedNamespaces = [
    'common', 'nav', 'auth', 'dashboard', 'service', 'truck',
    'workCard', 'mechanic', 'checklist', 'equipment',
    'auditLog', 'settings', 'user', 'calendar', 'report', 'section', 'errors',
  ]

  for (const ns of expectedNamespaces) {
    it(`namespace "${ns}" exists in both files`, () => {
      expect(bg[ns], `bg.json missing namespace "${ns}"`).toBeDefined()
      expect(en[ns], `en.json missing namespace "${ns}"`).toBeDefined()
    })
  }
})
