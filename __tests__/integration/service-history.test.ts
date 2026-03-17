import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/frotcom', () => ({ frotcomGet: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/prisma', async () => {
  const { db } = await import('./db')
  return { prisma: db }
})

import { getServerSession } from 'next-auth'
import { GET as getHistory } from '@/app/api/trucks/[id]/service-history/route'
import { db, cleanDb } from './db'

// ─── Helpers ────────────────────────────────────────────────────────────────

function managerSession() {
  return { user: { id: '1', name: 'Manager', role: 'MANAGER' as const, permissions: [], darkMode: false, pageSize: 10 } }
}

function getReq(url: string) {
  return new Request(url, { method: 'GET' })
}

function routeParams(id: number) {
  return { params: Promise.resolve({ id: String(id) }) }
}

async function createTruck(plate = `T${Date.now()}`) {
  return db.truck.create({
    data: { plateNumber: plate, make: 'MAN', model: 'TGX', isAdr: false, isActive: true },
  })
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanDb()
  vi.mocked(getServerSession).mockResolvedValue(managerSession())
})

// ─── Service history ─────────────────────────────────────────────────────────

describe('GET /api/trucks/[id]/service-history', () => {
  it('returns empty array for truck with no services', async () => {
    const truck = await createTruck('SH0001AA')

    const res = await getHistory(
      getReq(`http://localhost/api/trucks/${truck.id}/service-history`),
      routeParams(truck.id),
    )

    expect(res.status).toBe(200)
    const { services } = await res.json()
    expect(services).toEqual([])
  })

  it('returns services ordered by scheduledDate desc', async () => {
    const truck = await createTruck('SH0002BB')

    await db.serviceOrder.create({
      data: {
        truckId: truck.id, truckPlateSnapshot: truck.plateNumber,
        scheduledDate: new Date('2026-01-01'), status: 'COMPLETED', endDate: new Date(),
      },
    })
    await db.serviceOrder.create({
      data: {
        truckId: truck.id, truckPlateSnapshot: truck.plateNumber,
        scheduledDate: new Date('2026-06-15'), status: 'COMPLETED', endDate: new Date(),
      },
    })
    await db.serviceOrder.create({
      data: {
        truckId: truck.id, truckPlateSnapshot: truck.plateNumber,
        scheduledDate: new Date('2026-03-10'), status: 'COMPLETED', endDate: new Date(),
      },
    })

    const res = await getHistory(
      getReq(`http://localhost/api/trucks/${truck.id}/service-history`),
      routeParams(truck.id),
    )

    expect(res.status).toBe(200)
    const { services } = await res.json()
    expect(services).toHaveLength(3)
    // Most recent first
    const dates = services.map((s: { scheduledDate: string }) => new Date(s.scheduledDate).getTime())
    expect(dates[0]).toBeGreaterThan(dates[1])
    expect(dates[1]).toBeGreaterThan(dates[2])
  })

  it('excludes service by ID when exclude param provided', async () => {
    const truck = await createTruck('SH0003CC')

    const svc1 = await db.serviceOrder.create({
      data: {
        truckId: truck.id, truckPlateSnapshot: truck.plateNumber,
        scheduledDate: new Date('2026-01-01'), status: 'COMPLETED', endDate: new Date(),
      },
    })
    const svc2 = await db.serviceOrder.create({
      data: {
        truckId: truck.id, truckPlateSnapshot: truck.plateNumber,
        scheduledDate: new Date('2026-02-01'), status: 'COMPLETED', endDate: new Date(),
      },
    })

    const res = await getHistory(
      getReq(`http://localhost/api/trucks/${truck.id}/service-history?exclude=${svc1.id}`),
      routeParams(truck.id),
    )

    expect(res.status).toBe(200)
    const { services } = await res.json()
    expect(services).toHaveLength(1)
    expect(services[0].id).toBe(svc2.id)
  })

  it('calculates partsCost correctly from completed work cards', async () => {
    const truck    = await createTruck('SH0004DD')
    const mechanic = await db.mechanic.create({ data: { name: 'Иван Тестов', isActive: true } })

    const svc = await db.serviceOrder.create({
      data: {
        truckId: truck.id, truckPlateSnapshot: truck.plateNumber,
        scheduledDate: new Date('2026-05-01'), status: 'COMPLETED', endDate: new Date(),
      },
    })

    const section = await db.serviceSection.create({
      data: { serviceOrderId: svc.id, type: 'MID_SERVICE', title: 'Допълнителни', order: 1 },
    })

    const wc = await db.workCard.create({
      data: {
        serviceSectionId: section.id,
        mechanicId:       mechanic.id,
        mechanicName:     mechanic.name,
        description:      'Смяна на филтри',
        status:           'COMPLETED',
      },
    })

    await db.part.createMany({
      data: [
        { workCardId: wc.id, name: 'Маслен филтър',    quantity: 2, unitCost: 25.50 },
        { workCardId: wc.id, name: 'Въздушен филтър',   quantity: 1, unitCost: 45.00 },
      ],
    })

    const res = await getHistory(
      getReq(`http://localhost/api/trucks/${truck.id}/service-history`),
      routeParams(truck.id),
    )

    expect(res.status).toBe(200)
    const { services } = await res.json()
    expect(services).toHaveLength(1)
    // partsCost = (2 * 25.50) + (1 * 45.00) = 96.00
    expect(services[0].partsCost).toBe(96)
  })

  it('only includes COMPLETED work cards in response', async () => {
    const truck    = await createTruck('SH0005EE')
    const mechanic = await db.mechanic.create({ data: { name: 'Петър Тестов', isActive: true } })

    const svc = await db.serviceOrder.create({
      data: {
        truckId: truck.id, truckPlateSnapshot: truck.plateNumber,
        scheduledDate: new Date('2026-04-01'), status: 'IN_PROGRESS', startDate: new Date(),
      },
    })

    const section = await db.serviceSection.create({
      data: { serviceOrderId: svc.id, type: 'MID_SERVICE', title: 'Работа', order: 1 },
    })

    // COMPLETED work card — should appear
    await db.workCard.create({
      data: {
        serviceSectionId: section.id,
        mechanicId:       mechanic.id,
        mechanicName:     mechanic.name,
        description:      'Завършена задача',
        status:           'COMPLETED',
      },
    })

    // PENDING work card — should NOT appear
    await db.workCard.create({
      data: {
        serviceSectionId: section.id,
        mechanicId:       mechanic.id,
        mechanicName:     mechanic.name,
        description:      'Чакаща задача',
        status:           'PENDING',
      },
    })

    // IN_PROGRESS work card — should NOT appear
    await db.workCard.create({
      data: {
        serviceSectionId: section.id,
        mechanicId:       mechanic.id,
        mechanicName:     mechanic.name,
        description:      'В процес',
        status:           'IN_PROGRESS',
      },
    })

    // CANCELLED work card — should NOT appear
    await db.workCard.create({
      data: {
        serviceSectionId: section.id,
        mechanicId:       mechanic.id,
        mechanicName:     mechanic.name,
        description:      'Отменена',
        status:           'CANCELLED',
      },
    })

    const res = await getHistory(
      getReq(`http://localhost/api/trucks/${truck.id}/service-history`),
      routeParams(truck.id),
    )

    expect(res.status).toBe(200)
    const { services } = await res.json()
    expect(services).toHaveLength(1)
    expect(services[0].workCards).toHaveLength(1)
    expect(services[0].workCards[0].description).toBe('Завършена задача')
  })

  it('returns 401 without session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const truck = await createTruck('SH0006FF')

    const res = await getHistory(
      getReq(`http://localhost/api/trucks/${truck.id}/service-history`),
      routeParams(truck.id),
    )

    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid truck ID (NaN)', async () => {
    const res = await getHistory(
      getReq('http://localhost/api/trucks/abc/service-history'),
      { params: Promise.resolve({ id: 'abc' }) },
    )

    expect(res.status).toBe(400)
  })
})
