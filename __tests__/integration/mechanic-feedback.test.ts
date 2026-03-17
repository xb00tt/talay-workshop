import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mocks must be declared before route imports (Vitest hoists vi.mock)
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/frotcom', () => ({ frotcomGet: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/prisma', async () => {
  const { db } = await import('./db')
  return { prisma: db }
})

import { getServerSession } from 'next-auth'
import { POST as createItem } from '@/app/api/services/[id]/mechanic-feedback-items/route'
import { PATCH as updateItem, DELETE as deleteItem } from '@/app/api/services/[id]/mechanic-feedback-items/[itemId]/route'
import { db, cleanDb } from './db'

// ─── Helpers ────────────────────────────────────────────────────────────────

function managerSession() {
  return { user: { id: '1', name: 'Manager', role: 'MANAGER' as const, permissions: [], darkMode: false, pageSize: 10 } }
}

function assistantSession(permissions: string[] = []) {
  return { user: { id: '2', name: 'Assistant', role: 'ASSISTANT' as const, permissions, darkMode: false, pageSize: 10 } }
}

function postReq(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function patchReq(url: string, body: unknown) {
  return new Request(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function deleteReq(url: string) {
  return new Request(url, { method: 'DELETE' })
}

function routeParams(id: number) {
  return { params: Promise.resolve({ id: String(id) }) }
}

function itemRouteParams(id: number, itemId: number) {
  return { params: Promise.resolve({ id: String(id), itemId: String(itemId) }) }
}

async function createTruck(plate = `T${Date.now()}`) {
  return db.truck.create({
    data: { plateNumber: plate, make: 'MAN', model: 'TGX', isAdr: false, isActive: true },
  })
}

async function createActiveService(status = 'IN_PROGRESS') {
  const truck = await createTruck()
  return db.serviceOrder.create({
    data: {
      truckId: truck.id,
      truckPlateSnapshot: truck.plateNumber,
      scheduledDate: new Date(),
      status,
      startDate: new Date(),
    },
  })
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanDb()
  vi.mocked(getServerSession).mockResolvedValue(managerSession())
})

// ─── POST /api/services/[id]/mechanic-feedback-items ─────────────────────────

describe('POST /api/services/[id]/mechanic-feedback-items', () => {
  it('creates a mechanic feedback item on an active service (201)', async () => {
    const service = await createActiveService()

    const res = await createItem(
      postReq(`http://localhost/api/services/${service.id}/mechanic-feedback-items`, {
        description: 'Износена спирачна накладка',
      }),
      routeParams(service.id),
    )

    expect(res.status).toBe(201)
    const { item } = await res.json()
    expect(item.description).toBe('Износена спирачна накладка')
    expect(item.order).toBe(1)
    expect(item.serviceOrderId).toBe(service.id)
  })

  it('auto-calculates correct order when creating multiple items', async () => {
    const service = await createActiveService()

    await createItem(
      postReq(`http://localhost/api/services/${service.id}/mechanic-feedback-items`, {
        description: 'Първа забележка',
      }),
      routeParams(service.id),
    )

    const res = await createItem(
      postReq(`http://localhost/api/services/${service.id}/mechanic-feedback-items`, {
        description: 'Втора забележка',
      }),
      routeParams(service.id),
    )

    expect(res.status).toBe(201)
    const { item } = await res.json()
    expect(item.order).toBe(2)
  })

  it('returns 422 when description is empty', async () => {
    const service = await createActiveService()

    const res = await createItem(
      postReq(`http://localhost/api/services/${service.id}/mechanic-feedback-items`, {
        description: '',
      }),
      routeParams(service.id),
    )

    expect(res.status).toBe(422)
  })

  it('returns 422 when description is whitespace only', async () => {
    const service = await createActiveService()

    const res = await createItem(
      postReq(`http://localhost/api/services/${service.id}/mechanic-feedback-items`, {
        description: '   ',
      }),
      routeParams(service.id),
    )

    expect(res.status).toBe(422)
  })

  it('returns 422 when service is COMPLETED', async () => {
    const service = await createActiveService()
    await db.serviceOrder.update({
      where: { id: service.id },
      data: { status: 'COMPLETED', endDate: new Date() },
    })

    const res = await createItem(
      postReq(`http://localhost/api/services/${service.id}/mechanic-feedback-items`, {
        description: 'Тест',
      }),
      routeParams(service.id),
    )

    expect(res.status).toBe(422)
  })

  it('returns 422 when service is CANCELLED', async () => {
    const service = await createActiveService()
    await db.serviceOrder.update({
      where: { id: service.id },
      data: { status: 'CANCELLED', cancellationReason: 'Тест' },
    })

    const res = await createItem(
      postReq(`http://localhost/api/services/${service.id}/mechanic-feedback-items`, {
        description: 'Тест',
      }),
      routeParams(service.id),
    )

    expect(res.status).toBe(422)
  })
})

// ─── PATCH /api/services/[id]/mechanic-feedback-items/[itemId] ───────────────

describe('PATCH /api/services/[id]/mechanic-feedback-items/[itemId]', () => {
  it('updates the description of an existing item (200)', async () => {
    const service = await createActiveService()
    const item = await db.mechanicFeedbackItem.create({
      data: { serviceOrderId: service.id, description: 'Оригинално описание', order: 1 },
    })

    const res = await updateItem(
      patchReq(`http://localhost/api/services/${service.id}/mechanic-feedback-items/${item.id}`, {
        description: 'Обновено описание',
      }),
      itemRouteParams(service.id, item.id),
    )

    expect(res.status).toBe(200)
    const { item: updated } = await res.json()
    expect(updated.description).toBe('Обновено описание')
  })

  it('returns 422 when description is empty', async () => {
    const service = await createActiveService()
    const item = await db.mechanicFeedbackItem.create({
      data: { serviceOrderId: service.id, description: 'Тест', order: 1 },
    })

    const res = await updateItem(
      patchReq(`http://localhost/api/services/${service.id}/mechanic-feedback-items/${item.id}`, {
        description: '',
      }),
      itemRouteParams(service.id, item.id),
    )

    expect(res.status).toBe(422)
  })
})

// ─── DELETE /api/services/[id]/mechanic-feedback-items/[itemId] ──────────────

describe('DELETE /api/services/[id]/mechanic-feedback-items/[itemId]', () => {
  it('removes the item and returns success (200)', async () => {
    const service = await createActiveService()
    const item = await db.mechanicFeedbackItem.create({
      data: { serviceOrderId: service.id, description: 'За изтриване', order: 1 },
    })

    const res = await deleteItem(
      deleteReq(`http://localhost/api/services/${service.id}/mechanic-feedback-items/${item.id}`),
      itemRouteParams(service.id, item.id),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)

    // Verify actually deleted from DB
    const deleted = await db.mechanicFeedbackItem.findUnique({ where: { id: item.id } })
    expect(deleted).toBeNull()
  })
})

// ─── Permission checks ──────────────────────────────────────────────────────

describe('PATCH/DELETE — assistant without service.create permission', () => {
  it('returns 403 for PATCH and DELETE when assistant lacks service.create', async () => {
    vi.mocked(getServerSession).mockResolvedValue(assistantSession([]))

    const service = await createActiveService()
    const item = await db.mechanicFeedbackItem.create({
      data: { serviceOrderId: service.id, description: 'Тест', order: 1 },
    })

    const patchRes = await updateItem(
      patchReq(`http://localhost/api/services/${service.id}/mechanic-feedback-items/${item.id}`, {
        description: 'Нещо ново',
      }),
      itemRouteParams(service.id, item.id),
    )
    expect(patchRes.status).toBe(403)

    const deleteRes = await deleteItem(
      deleteReq(`http://localhost/api/services/${service.id}/mechanic-feedback-items/${item.id}`),
      itemRouteParams(service.id, item.id),
    )
    expect(deleteRes.status).toBe(403)
  })
})
