import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mocks must be declared before route imports (Vitest hoists vi.mock)
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/frotcom', () => ({ frotcomGet: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/prisma', async () => {
  const { db } = await import('./db')
  return { prisma: db }
})

import { getServerSession } from 'next-auth'
import { GET as getDashboard } from '@/app/api/dashboard/route'
import { db, cleanDb } from './db'

// ─── Helpers ────────────────────────────────────────────────────────────────

function managerSession() {
  return { user: { id: '1', name: 'Manager', role: 'MANAGER' as const, permissions: [], darkMode: false, pageSize: 10 } }
}

async function createTruck(overrides: Record<string, unknown> = {}) {
  return db.truck.create({
    data: {
      plateNumber: `T${Date.now()}`,
      make: 'MAN',
      model: 'TGX',
      isAdr: false,
      isActive: true,
      currentMileage: 80000,
      mileageTriggerKm: 30000,
      ...overrides,
    },
  })
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanDb()
  vi.mocked(getServerSession).mockResolvedValue(managerSession())
})

// ─── Mileage alerts ──────────────────────────────────────────────────────────

describe('GET /api/dashboard — mileage alerts', () => {
  it('shows alert when truck is over threshold with completed service', async () => {
    const truck = await createTruck({ plateNumber: 'MA0001', currentMileage: 80000, mileageTriggerKm: 30000 })

    await db.serviceOrder.create({
      data: {
        truckId: truck.id,
        truckPlateSnapshot: truck.plateNumber,
        scheduledDate: new Date(),
        status: 'COMPLETED',
        mileageAtService: 40000,
        endDate: new Date(),
      },
    })

    const res = await getDashboard()
    expect(res.status).toBe(200)

    const { mileageAlerts } = await res.json()
    expect(mileageAlerts).toHaveLength(1)
    expect(mileageAlerts[0].plateNumber).toBe('MA0001')
    expect(mileageAlerts[0].currentMileage).toBe(80000)
    expect(mileageAlerts[0].lastServiceMileage).toBe(40000)
  })

  it('does not show alert when truck is below threshold', async () => {
    const truck = await createTruck({ plateNumber: 'MA0002', currentMileage: 50000, mileageTriggerKm: 30000 })

    await db.serviceOrder.create({
      data: {
        truckId: truck.id,
        truckPlateSnapshot: truck.plateNumber,
        scheduledDate: new Date(),
        status: 'COMPLETED',
        mileageAtService: 30000,
        endDate: new Date(),
      },
    })

    const res = await getDashboard()
    expect(res.status).toBe(200)

    const { mileageAlerts } = await res.json()
    expect(mileageAlerts).toHaveLength(0)
  })

  it('excludes trucks with active services even if over threshold', async () => {
    const truck = await createTruck({ plateNumber: 'MA0003', currentMileage: 80000, mileageTriggerKm: 30000 })

    // Completed service — would normally trigger alert
    await db.serviceOrder.create({
      data: {
        truckId: truck.id,
        truckPlateSnapshot: truck.plateNumber,
        scheduledDate: new Date('2026-01-01'),
        status: 'COMPLETED',
        mileageAtService: 40000,
        endDate: new Date('2026-01-02'),
      },
    })

    // Active service — should suppress alert
    await db.serviceOrder.create({
      data: {
        truckId: truck.id,
        truckPlateSnapshot: truck.plateNumber,
        scheduledDate: new Date('2026-03-01'),
        status: 'INTAKE',
        startDate: new Date(),
      },
    })

    const res = await getDashboard()
    expect(res.status).toBe(200)

    const { mileageAlerts } = await res.json()
    expect(mileageAlerts).toHaveLength(0)
  })

  it('falls back to lastKnownServiceMileage when no completed service exists', async () => {
    await createTruck({
      plateNumber: 'MA0004',
      currentMileage: 80000,
      lastKnownServiceMileage: 40000,
      mileageTriggerKm: 30000,
    })

    const res = await getDashboard()
    expect(res.status).toBe(200)

    const { mileageAlerts } = await res.json()
    expect(mileageAlerts).toHaveLength(1)
    expect(mileageAlerts[0].plateNumber).toBe('MA0004')
    expect(mileageAlerts[0].lastServiceMileage).toBe(40000)
  })

  it('does not show alert when no completed service and no lastKnownServiceMileage', async () => {
    await createTruck({
      plateNumber: 'MA0005',
      currentMileage: 80000,
      mileageTriggerKm: 30000,
      lastKnownServiceMileage: null,
    })

    const res = await getDashboard()
    expect(res.status).toBe(200)

    const { mileageAlerts } = await res.json()
    expect(mileageAlerts).toHaveLength(0)
  })

  it('returns 401 without session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res = await getDashboard()
    expect(res.status).toBe(401)
  })
})
