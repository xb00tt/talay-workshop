import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('proxy.ts (formerly middleware)', () => {
  it('proxy.ts file exists', () => {
    expect(fs.existsSync(path.resolve('proxy.ts'))).toBe(true)
  })

  it('middleware.ts has been removed (renamed to proxy.ts)', () => {
    expect(fs.existsSync(path.resolve('middleware.ts'))).toBe(false)
  })

  it('proxy.ts contains the route matcher config', () => {
    const src = fs.readFileSync(path.resolve('proxy.ts'), 'utf8')
    expect(src).toContain('matcher')
  })

  it('proxy.ts protects the root and app routes', () => {
    const src = fs.readFileSync(path.resolve('proxy.ts'), 'utf8')
    // Matcher must cover all routes except public ones
    expect(src).toContain('login')
    expect(src).toContain('setup')
    expect(src).toContain('api/auth')
  })

  it('proxy.ts excludes static assets from protection', () => {
    const src = fs.readFileSync(path.resolve('proxy.ts'), 'utf8')
    expect(src).toContain('_next')
  })
})
