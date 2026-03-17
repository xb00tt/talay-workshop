import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/prisma', async () => {
  const { db } = await import('./db')
  return { prisma: db }
})

import { getServerSession } from 'next-auth'
import { POST as createService } from '@/app/api/services/route'
import { POST as advanceStatus } from '@/app/api/services/[id]/status/route'
import { db, cleanDb } from './db'

// ─── Helpers ────────────────────────────────────────────────────────────────

function session(role: 'MANAGER' | 'ASSISTANT', permissions: string[] = []) {
  return { user: { id: '1', name: 'Test', role, permissions, darkMode: false, pageSize: 10 } }
}

function postBody(body: unknown) {
  return new Request('http://localhost/api/services', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanDb()
})

// ─── Auth guards ─────────────────────────────────────────────────────────────

describe('Authentication guard', () => {
  it('returns 401 when session is null (not logged in)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await createService(postBody({ truckId: 1, scheduledDate: '2026-06-01' }))

    expect(res.status).toBe(401)
  })
})

// ─── Permission guards ────────────────────────────────────────────────────────

describe('Permission guard on POST /api/services', () => {
  it('returns 403 when ASSISTANT has no permissions', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ASSISTANT', []))

    const res = await createService(postBody({ truckId: 1, scheduledDate: '2026-06-01' }))

    expect(res.status).toBe(403)
  })

  it('returns 403 when ASSISTANT has unrelated permissions', async () => {
    vi.mocked(getServerSession).mockResolvedValue(
      session('ASSISTANT', ['truck.edit', 'report.view', 'mechanic.manage']),
    )

    const res = await createService(postBody({ truckId: 1, scheduledDate: '2026-06-01' }))

    expect(res.status).toBe(403)
  })

  it('passes the auth guard when ASSISTANT has service.create', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ASSISTANT', ['service.create']))

    // Truck doesn't exist → 404, but that's past the auth guard
    const res = await createService(postBody({ truckId: 99999, scheduledDate: '2026-06-01' }))

    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })

  it('MANAGER always passes the permission guard regardless of permissions array', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('MANAGER', []))

    const res = await createService(postBody({ truckId: 99999, scheduledDate: '2026-06-01' }))

    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })

  it('MANAGER with valid data creates a service successfully', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('MANAGER', []))
    const truck = await db.truck.create({
      data: { plateNumber: 'PM1234PM', make: 'Scania', model: 'R450', isAdr: false, isActive: true },
    })

    const res = await createService(postBody({ truckId: truck.id, scheduledDate: '2026-06-15' }))

    expect(res.status).toBe(201)
  })

  it('ASSISTANT with service.create and valid data creates a service successfully', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ASSISTANT', ['service.create']))
    const truck = await db.truck.create({
      data: { plateNumber: 'PA9876PA', make: 'Volvo', model: 'FH', isAdr: false, isActive: true },
    })

    const res = await createService(postBody({ truckId: truck.id, scheduledDate: '2026-06-20' }))

    expect(res.status).toBe(201)
  })
})

// ─── Permission guard on status transitions ───────────────────────────────────

describe('Permission guard on POST /api/services/[id]/status', () => {
  async function makeIntakeService() {
    const truck = await db.truck.create({
      data: { plateNumber: `ST${Date.now()}`, make: 'MAN', model: 'TGX', isAdr: false, isActive: true },
    })
    const service = await db.serviceOrder.create({
      data: {
        truckId:           truck.id,
        truckPlateSnapshot: truck.plateNumber,
        scheduledDate:     new Date(),
        status:            'INTAKE',
        startDate:         new Date(),
      },
    })
    await db.serviceSection.createMany({
      data: [
        { serviceOrderId: service.id, type: 'CHECKLIST',       title: 'CL', order: 1 },
        { serviceOrderId: service.id, type: 'EQUIPMENT_CHECK', title: 'EQ', order: 2 },
      ],
    })
    return service
  }

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const service = await makeIntakeService()

    const res = await advanceStatus(
      new Request(`http://localhost/api/services/${service.id}/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"force":true}',
      }),
      { params: Promise.resolve({ id: String(service.id) }) },
    )

    expect(res.status).toBe(401)
  })

  it('returns 403 when ASSISTANT lacks service.advance permission', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ASSISTANT', []))
    const service = await makeIntakeService()

    const res = await advanceStatus(
      new Request(`http://localhost/api/services/${service.id}/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"force":true}',
      }),
      { params: Promise.resolve({ id: String(service.id) }) },
    )

    expect(res.status).toBe(403)
  })

  it('ASSISTANT with service.advance can advance service status', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ASSISTANT', ['service.advance']))
    const service = await makeIntakeService()

    const res = await advanceStatus(
      new Request(`http://localhost/api/services/${service.id}/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"force":true}',
      }),
      { params: Promise.resolve({ id: String(service.id) }) },
    )

    expect(res.status).toBe(200)
    expect((await res.json()).service.status).toBe('IN_PROGRESS')
  })
})
