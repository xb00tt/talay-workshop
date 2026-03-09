import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/prisma', async () => {
  const { db } = await import('./db')
  return { prisma: db }
})

import { getServerSession } from 'next-auth'
import { PATCH as patchService } from '@/app/api/services/[id]/route'
import { db, cleanDb } from './db'

// ─── Helpers ────────────────────────────────────────────────────────────────

function session(role: 'MANAGER' | 'ASSISTANT', permissions: string[] = []) {
  return { user: { id: '1', name: 'Test', role, permissions, darkMode: false, pageSize: 10 } }
}

function patchReq(serviceId: number, body: unknown) {
  return new Request(`http://localhost/api/services/${serviceId}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

function routeParams(id: number) {
  return { params: Promise.resolve({ id: String(id) }) }
}

async function createScheduledService() {
  const truck = await db.truck.create({
    data: { plateNumber: `S${Date.now()}`, make: 'MAN', model: 'TGX', isAdr: false, isActive: true },
  })
  return db.serviceOrder.create({
    data: { truckId: truck.id, truckPlateSnapshot: truck.plateNumber, scheduledDate: new Date(), status: 'SCHEDULED' },
  })
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanDb()
})

// ─── Service cancellation ─────────────────────────────────────────────────────

describe('PATCH /api/services/[id] — cancellation', () => {
  it('cancels a service when MANAGER provides a reason', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('MANAGER'))
    const service = await createScheduledService()

    const res = await patchService(
      patchReq(service.id, { status: 'CANCELLED', cancellationReason: 'Клиентът се отказа.' }),
      routeParams(service.id),
    )

    expect(res.status).toBe(200)
    const { service: updated } = await res.json()
    expect(updated.status).toBe('CANCELLED')
    expect(updated.cancellationReason).toBe('Клиентът се отказа.')
  })

  it('returns 422 when cancellation reason is missing', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('MANAGER'))
    const service = await createScheduledService()

    const res = await patchService(
      patchReq(service.id, { status: 'CANCELLED' }),
      routeParams(service.id),
    )

    expect(res.status).toBe(422)
  })

  it('returns 422 when cancellation reason is blank', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('MANAGER'))
    const service = await createScheduledService()

    const res = await patchService(
      patchReq(service.id, { status: 'CANCELLED', cancellationReason: '   ' }),
      routeParams(service.id),
    )

    expect(res.status).toBe(422)
  })

  it('returns 403 when ASSISTANT lacks service.cancel permission', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ASSISTANT', ['service.create']))
    const service = await createScheduledService()

    const res = await patchService(
      patchReq(service.id, { status: 'CANCELLED', cancellationReason: 'Test' }),
      routeParams(service.id),
    )

    expect(res.status).toBe(403)
  })

  it('ASSISTANT with service.cancel permission can cancel', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ASSISTANT', ['service.cancel']))
    const service = await createScheduledService()

    const res = await patchService(
      patchReq(service.id, { status: 'CANCELLED', cancellationReason: 'По искане на шофьора.' }),
      routeParams(service.id),
    )

    expect(res.status).toBe(200)
  })

  it('returns 404 for a non-existent service', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('MANAGER'))

    const res = await patchService(
      patchReq(99999, { status: 'CANCELLED', cancellationReason: 'Test' }),
      routeParams(99999),
    )

    expect(res.status).toBe(404)
  })

  it('returns 422 when cancelling a COMPLETED service', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('MANAGER'))
    const truck = await db.truck.create({
      data: { plateNumber: `CC${Date.now()}`, make: 'Volvo', model: 'FH', isAdr: false, isActive: true },
    })
    const service = await db.serviceOrder.create({
      data: { truckId: truck.id, truckPlateSnapshot: truck.plateNumber, scheduledDate: new Date(), status: 'COMPLETED', endDate: new Date() },
    })

    const res = await patchService(
      patchReq(service.id, { status: 'CANCELLED', cancellationReason: 'Тест' }),
      routeParams(service.id),
    )

    expect(res.status).toBe(422)
  })

  it('returns 422 when cancelling an already-cancelled service', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('MANAGER'))
    const truck = await db.truck.create({
      data: { plateNumber: `CA${Date.now()}`, make: 'DAF', model: 'CF', isAdr: false, isActive: true },
    })
    const service = await db.serviceOrder.create({
      data: { truckId: truck.id, truckPlateSnapshot: truck.plateNumber, scheduledDate: new Date(), status: 'CANCELLED', cancellationReason: 'Вече отменена.' },
    })

    const res = await patchService(
      patchReq(service.id, { status: 'CANCELLED', cancellationReason: 'Отново' }),
      routeParams(service.id),
    )

    expect(res.status).toBe(422)
  })
})

// ─── Service reschedule ───────────────────────────────────────────────────────

describe('PATCH /api/services/[id] — reschedule', () => {
  it('updates the scheduled date for a SCHEDULED service', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('MANAGER'))
    const service = await createScheduledService()

    const res = await patchService(
      patchReq(service.id, { scheduledDate: '2027-03-15' }),
      routeParams(service.id),
    )

    expect(res.status).toBe(200)
    const { service: updated } = await res.json()
    expect(new Date(updated.scheduledDate).toISOString()).toContain('2027-03-15')
  })

  it('returns 422 when rescheduling a non-SCHEDULED service', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('MANAGER'))
    const truck = await db.truck.create({
      data: { plateNumber: `R${Date.now()}`, make: 'DAF', model: 'CF', isAdr: false, isActive: true },
    })
    const bay = await db.bay.create({ data: { name: `B${Date.now()}`, isActive: true } })
    const service = await db.serviceOrder.create({
      data: {
        truckId: truck.id, truckPlateSnapshot: truck.plateNumber,
        scheduledDate: new Date(), status: 'INTAKE',
        bayId: bay.id, bayNameSnapshot: bay.name, startDate: new Date(),
      },
    })

    const res = await patchService(
      patchReq(service.id, { scheduledDate: '2027-04-01' }),
      routeParams(service.id),
    )

    expect(res.status).toBe(422)
  })

  it('returns 422 for an invalid date format', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('MANAGER'))
    const service = await createScheduledService()

    const res = await patchService(
      patchReq(service.id, { scheduledDate: 'not-a-date' }),
      routeParams(service.id),
    )

    expect(res.status).toBe(422)
  })

  it('returns 403 when ASSISTANT lacks service.reschedule permission', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ASSISTANT', ['service.create']))
    const service = await createScheduledService()

    const res = await patchService(
      patchReq(service.id, { scheduledDate: '2027-05-01' }),
      routeParams(service.id),
    )

    expect(res.status).toBe(403)
  })
})

// ─── 404 handling ─────────────────────────────────────────────────────────────

describe('GET /api/services/[id] — 404', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await patchService(
      patchReq(1, { scheduledDate: '2027-01-01' }),
      routeParams(1),
    )

    expect(res.status).toBe(401)
  })
})
