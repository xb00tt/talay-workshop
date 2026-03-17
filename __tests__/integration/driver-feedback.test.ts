import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/prisma', async () => {
  const { db } = await import('./db')
  return { prisma: db }
})

import { getServerSession } from 'next-auth'
import { PATCH as updateFeedback, DELETE as deleteFeedback } from '@/app/api/services/[id]/feedback-items/[itemId]/route'
import { db, cleanDb } from './db'

// ─── Helpers ────────────────────────────────────────────────────────────────

function session(role: 'MANAGER' | 'ASSISTANT', permissions: string[] = []) {
  return { user: { id: '1', name: 'Test', role, permissions, darkMode: false, pageSize: 10 } }
}

function patchReq(url: string, body: unknown) {
  return new Request(url, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

function deleteReq(url: string) {
  return new Request(url, { method: 'DELETE' })
}

function routeParams(id: number, itemId: number) {
  return { params: Promise.resolve({ id: String(id), itemId: String(itemId) }) }
}

async function createTruck(plate = `DF${Date.now()}`) {
  return db.truck.create({
    data: { plateNumber: plate, make: 'MAN', model: 'TGX', isAdr: false, isActive: true },
  })
}

async function createServiceWithFeedbackItem() {
  const truck = await createTruck()
  const service = await db.serviceOrder.create({
    data: {
      truckId:           truck.id,
      truckPlateSnapshot: truck.plateNumber,
      scheduledDate:     new Date(),
      status:            'INTAKE',
      startDate:         new Date(),
    },
  })
  const item = await db.driverFeedbackItem.create({
    data: {
      serviceOrderId: service.id,
      description:    'Шум от предния мост',
      order:          1,
    },
  })
  return { service, item }
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanDb()
  vi.mocked(getServerSession).mockResolvedValue(session('MANAGER'))
})

// ─── Driver feedback items ───────────────────────────────────────────────────

describe('PATCH /api/services/[id]/feedback-items/[itemId]', () => {
  it('updates the description successfully', async () => {
    const { service, item } = await createServiceWithFeedbackItem()

    const res = await updateFeedback(
      patchReq(
        `http://localhost/api/services/${service.id}/feedback-items/${item.id}`,
        { description: 'Вибрации при спиране' },
      ),
      routeParams(service.id, item.id),
    )

    expect(res.status).toBe(200)
    const { item: updated } = await res.json()
    expect(updated.description).toBe('Вибрации при спиране')
  })

  it('returns 422 with empty description', async () => {
    const { service, item } = await createServiceWithFeedbackItem()

    const res = await updateFeedback(
      patchReq(
        `http://localhost/api/services/${service.id}/feedback-items/${item.id}`,
        { description: '   ' },
      ),
      routeParams(service.id, item.id),
    )

    expect(res.status).toBe(422)
  })

  it('returns 403 for ASSISTANT without service.create permission', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ASSISTANT', []))
    const { service, item } = await createServiceWithFeedbackItem()

    const res = await updateFeedback(
      patchReq(
        `http://localhost/api/services/${service.id}/feedback-items/${item.id}`,
        { description: 'Нова стойност' },
      ),
      routeParams(service.id, item.id),
    )

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/services/[id]/feedback-items/[itemId]', () => {
  it('deletes the feedback item and verifies it is gone', async () => {
    const { service, item } = await createServiceWithFeedbackItem()

    const res = await deleteFeedback(
      deleteReq(`http://localhost/api/services/${service.id}/feedback-items/${item.id}`),
      routeParams(service.id, item.id),
    )

    expect(res.status).toBe(200)
    const { success } = await res.json()
    expect(success).toBe(true)

    // Verify item is actually gone from the database
    const found = await db.driverFeedbackItem.findUnique({ where: { id: item.id } })
    expect(found).toBeNull()
  })

  it('returns 401 without session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { service, item } = await createServiceWithFeedbackItem()

    const res = await deleteFeedback(
      deleteReq(`http://localhost/api/services/${service.id}/feedback-items/${item.id}`),
      routeParams(service.id, item.id),
    )

    expect(res.status).toBe(401)
  })
})
