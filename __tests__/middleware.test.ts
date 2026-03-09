import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('middleware.ts (Next.js route protection)', () => {
  it('middleware.ts file exists at the project root', () => {
    expect(fs.existsSync(path.resolve('middleware.ts'))).toBe(true)
  })

  it('proxy.ts has been removed (renamed to middleware.ts)', () => {
    expect(fs.existsSync(path.resolve('proxy.ts'))).toBe(false)
  })

  it('middleware.ts contains the route matcher config', () => {
    const src = fs.readFileSync(path.resolve('middleware.ts'), 'utf8')
    expect(src).toContain('matcher')
  })

  it('middleware.ts protects the root and app routes', () => {
    const src = fs.readFileSync(path.resolve('middleware.ts'), 'utf8')
    expect(src).toContain('login')
    expect(src).toContain('setup')
    expect(src).toContain('api/auth')
  })

  it('middleware.ts excludes static assets from protection', () => {
    const src = fs.readFileSync(path.resolve('middleware.ts'), 'utf8')
    expect(src).toContain('_next')
  })
})
