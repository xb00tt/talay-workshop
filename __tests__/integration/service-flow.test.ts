import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mocks must be declared before route imports (Vitest hoists vi.mock)
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/frotcom', () => ({ frotcomGet: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/prisma', async () => {
  const { db } = await import('./db')
  return { prisma: db }
})

import { getServerSession } from 'next-auth'
import { POST as createService }  from '@/app/api/services/route'
import { POST as doIntake }       from '@/app/api/services/[id]/intake/route'
import { POST as advanceStatus }  from '@/app/api/services/[id]/status/route'
import { db, cleanDb } from './db'

// ─── Helpers ────────────────────────────────────────────────────────────────

function managerSession() {
  return { user: { id: '1', name: 'Manager', role: 'MANAGER' as const, permissions: [], darkMode: false, pageSize: 10 } }
}

function postReq(url: string, body: unknown) {
  return new Request(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

function routeParams(id: number) {
  return { params: Promise.resolve({ id: String(id) }) }
}

async function createTruck(plate = `T${Date.now()}`) {
  return db.truck.create({
    data: { plateNumber: plate, make: 'MAN', model: 'TGX', isAdr: false, isActive: true },
  })
}

async function createBay(name = `Bay ${Date.now()}`) {
  return db.bay.create({ data: { name, isActive: true } })
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanDb()
  vi.mocked(getServerSession).mockResolvedValue(managerSession())
})

// ─── Service order creation ───────────────────────────────────────────────────

describe('POST /api/services — create service order', () => {
  it('creates a SCHEDULED service order for an active truck', async () => {
    const truck = await createTruck('CA1234AB')

    const res = await createService(postReq('http://localhost/api/services', {
      truckId:       truck.id,
      scheduledDate: '2026-06-01',
    }))

    expect(res.status).toBe(201)
    const { service } = await res.json()
    expect(service.status).toBe('SCHEDULED')
    expect(service.truckPlateSnapshot).toBe('CA1234AB')
  })

  it('returns 422 when truck is inactive', async () => {
    const truck = await db.truck.create({
      data: { plateNumber: 'CB0001', make: 'DAF', model: 'XF', isAdr: false, isActive: false },
    })

    const res = await createService(postReq('http://localhost/api/services', {
      truckId:       truck.id,
      scheduledDate: '2026-06-01',
    }))

    expect(res.status).toBe(422)
  })

  it('returns 409 when the truck already has an active service', async () => {
    const truck = await createTruck('CC9999EE')

    await db.serviceOrder.create({
      data: { truckId: truck.id, truckPlateSnapshot: truck.plateNumber, scheduledDate: new Date(), status: 'SCHEDULED' },
    })

    const res = await createService(postReq('http://localhost/api/services', {
      truckId:       truck.id,
      scheduledDate: '2026-06-02',
    }))

    expect(res.status).toBe(409)
  })

  it('returns 422 when no truckId provided', async () => {
    const res = await createService(postReq('http://localhost/api/services', {
      scheduledDate: '2026-06-01',
    }))
    expect(res.status).toBe(422)
  })
})

// ─── Service intake ───────────────────────────────────────────────────────────

describe('POST /api/services/[id]/intake', () => {
  it('advances SCHEDULED → INTAKE, creates CHECKLIST + EQUIPMENT_CHECK sections', async () => {
    const truck   = await createTruck('TX1111AX')
    const bay     = await createBay('Бокс 1')
    const service = await db.serviceOrder.create({
      data: { truckId: truck.id, truckPlateSnapshot: truck.plateNumber, scheduledDate: new Date(), status: 'SCHEDULED' },
    })

    const res = await doIntake(
      postReq(`http://localhost/api/services/${service.id}/intake`, { bayId: bay.id }),
      routeParams(service.id),
    )

    expect(res.status).toBe(200)
    const { service: updated } = await res.json()
    expect(updated.status).toBe('INTAKE')
    expect(updated.bayNameSnapshot).toBe('Бокс 1')
    const types = updated.sections.map((s: { type: string }) => s.type).sort()
    expect(types).toEqual(['CHECKLIST', 'EQUIPMENT_CHECK'])
  })

  it('copies active checklist template items into the CHECKLIST section', async () => {
    await db.checklistTemplate.createMany({
      data: [
        { description: 'Проверка на масло',   order: 1, isActive: true },
        { description: 'Проверка на гуми',    order: 2, isActive: true },
        { description: 'Неактивна точка',     order: 3, isActive: false },
      ],
    })

    const truck   = await createTruck('TX2222BX')
    const bay     = await createBay('Бокс 2')
    const service = await db.serviceOrder.create({
      data: { truckId: truck.id, truckPlateSnapshot: truck.plateNumber, scheduledDate: new Date(), status: 'SCHEDULED' },
    })

    const res = await doIntake(
      postReq(`http://localhost/api/services/${service.id}/intake`, { bayId: bay.id }),
      routeParams(service.id),
    )

    expect(res.status).toBe(200)
    const checklistSection = (await res.json()).service.sections.find(
      (s: { type: string }) => s.type === 'CHECKLIST',
    )
    // Only 2 active items should be copied
    expect(checklistSection.checklistItems).toHaveLength(2)
  })

  it('returns 422 when service is not SCHEDULED', async () => {
    const truck = await createTruck('TX3333CX')
    const bay   = await createBay('Бокс 3')
    const service = await db.serviceOrder.create({
      data: {
        truckId:           truck.id,
        truckPlateSnapshot: truck.plateNumber,
        scheduledDate:     new Date(),
        status:            'IN_PROGRESS',
        bayId:             bay.id,
        bayNameSnapshot:   bay.name,
        startDate:         new Date(),
      },
    })

    const res = await doIntake(
      postReq(`http://localhost/api/services/${service.id}/intake`, { bayId: bay.id }),
      routeParams(service.id),
    )

    expect(res.status).toBe(422)
  })

  it('returns 409 when the bay is already occupied', async () => {
    const truck1  = await createTruck('TX4444DX')
    const truck2  = await createTruck('TX5555EX')
    const bay     = await createBay('Бокс 4')

    await db.serviceOrder.create({
      data: {
        truckId:           truck1.id,
        truckPlateSnapshot: truck1.plateNumber,
        scheduledDate:     new Date(),
        status:            'INTAKE',
        bayId:             bay.id,
        bayNameSnapshot:   bay.name,
        startDate:         new Date(),
      },
    })

    const service2 = await db.serviceOrder.create({
      data: { truckId: truck2.id, truckPlateSnapshot: truck2.plateNumber, scheduledDate: new Date(), status: 'SCHEDULED' },
    })

    const res = await doIntake(
      postReq(`http://localhost/api/services/${service2.id}/intake`, { bayId: bay.id }),
      routeParams(service2.id),
    )

    expect(res.status).toBe(409)
  })
})

// ─── Status progression ───────────────────────────────────────────────────────

describe('POST /api/services/[id]/status — stage transitions', () => {
  /** Creates a service at INTAKE with both required sections present. */
  async function setupIntakeService() {
    const truck   = await createTruck()
    const bay     = await createBay()
    const service = await db.serviceOrder.create({
      data: {
        truckId:           truck.id,
        truckPlateSnapshot: truck.plateNumber,
        scheduledDate:     new Date(),
        status:            'INTAKE',
        bayId:             bay.id,
        bayNameSnapshot:   bay.name,
        startDate:         new Date(),
      },
    })
    await db.serviceSection.createMany({
      data: [
        { serviceOrderId: service.id, type: 'CHECKLIST',       title: 'Checklist', order: 1 },
        { serviceOrderId: service.id, type: 'EQUIPMENT_CHECK', title: 'Equipment', order: 2 },
      ],
    })
    return service
  }

  it('advances INTAKE → IN_PROGRESS with force flag', async () => {
    const service = await setupIntakeService()

    const res = await advanceStatus(
      postReq(`http://localhost/api/services/${service.id}/status`, { force: true }),
      routeParams(service.id),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).service.status).toBe('IN_PROGRESS')
  })

  it('returns warnings (status 200, no transition) when force is false and checks are missing', async () => {
    const service = await setupIntakeService()

    const res = await advanceStatus(
      postReq(`http://localhost/api/services/${service.id}/status`, { force: false }),
      routeParams(service.id),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.warnings).toBeDefined()
    expect(body.warnings.length).toBeGreaterThan(0)
    // Service must NOT have advanced
    const current = await db.serviceOrder.findUnique({ where: { id: service.id } })
    expect(current?.status).toBe('INTAKE')
  })

  it('completes the full lifecycle: INTAKE → IN_PROGRESS → QUALITY_CHECK → READY → COMPLETED', async () => {
    const service = await setupIntakeService()
    const stages  = ['IN_PROGRESS', 'QUALITY_CHECK', 'READY', 'COMPLETED']

    for (const expectedStatus of stages) {
      const res = await advanceStatus(
        postReq(`http://localhost/api/services/${service.id}/status`, { force: true }),
        routeParams(service.id),
      )
      expect(res.status).toBe(200)
      expect((await res.json()).service.status).toBe(expectedStatus)
    }

    // Verify endDate is set on completion
    const completed = await db.serviceOrder.findUnique({ where: { id: service.id } })
    expect(completed?.endDate).not.toBeNull()
  })

  it('creates a TruckEquipmentSnapshot with INTAKE items when exit check was skipped', async () => {
    const service = await setupIntakeService()

    // Seed INTAKE equipment check items
    await db.equipmentCheckItem.createMany({
      data: [
        { serviceOrderId: service.id, itemName: 'Светлоотразителен жилетка', status: 'PRESENT', checkType: 'INTAKE' },
        { serviceOrderId: service.id, itemName: 'Триъгълник',                status: 'MISSING', checkType: 'INTAKE' },
      ],
    })

    // Mark the exit check as skipped — snapshot falls back to INTAKE items
    const eqSection = await db.serviceSection.findFirst({
      where: { serviceOrderId: service.id, type: 'EQUIPMENT_CHECK' },
    })
    await db.serviceSection.update({
      where: { id: eqSection!.id },
      data:  { exitSkippedAt: new Date(), exitSkipNote: 'Skipped in test' },
    })

    // Run through to COMPLETED
    for (let i = 0; i < 4; i++) {
      await advanceStatus(
        postReq(`http://localhost/api/services/${service.id}/status`, { force: true }),
        routeParams(service.id),
      )
    }

    const snapshot = await db.truckEquipmentSnapshot.findFirst({
      where:   { serviceOrderId: service.id },
      include: { items: true },
    })

    expect(snapshot).not.toBeNull()
    expect(snapshot!.items).toHaveLength(2)
    expect(snapshot!.items.map((i) => i.itemName)).toContain('Триъгълник')
  })

  it('returns 422 when trying to advance a COMPLETED service', async () => {
    const service = await setupIntakeService()
    await db.serviceOrder.update({
      where: { id: service.id },
      data:  { status: 'COMPLETED', endDate: new Date() },
    })

    const res = await advanceStatus(
      postReq(`http://localhost/api/services/${service.id}/status`, { force: true }),
      routeParams(service.id),
    )

    expect(res.status).toBe(422)
  })

  it('returns 422 when trying to advance a SCHEDULED service (not yet at INTAKE)', async () => {
    const truck   = await createTruck()
    const service = await db.serviceOrder.create({
      data: { truckId: truck.id, truckPlateSnapshot: truck.plateNumber, scheduledDate: new Date(), status: 'SCHEDULED' },
    })

    const res = await advanceStatus(
      postReq(`http://localhost/api/services/${service.id}/status`, { force: true }),
      routeParams(service.id),
    )

    expect(res.status).toBe(422)
  })

  it('auto-advances PENDING work cards to IN_PROGRESS when service moves to IN_PROGRESS', async () => {
    const service  = await setupIntakeService()
    const section  = await db.serviceSection.findFirst({ where: { serviceOrderId: service.id, type: 'CHECKLIST' } })
    const mechanic = await db.mechanic.create({ data: { name: 'Петър Иванов', isActive: true } })
    const workCard = await db.workCard.create({
      data: {
        serviceSectionId:  section!.id,
        mechanicId:        mechanic.id,
        mechanicName:      mechanic.name,
        description:       'Смяна на масло',
        status:            'PENDING',
      },
    })

    await advanceStatus(
      postReq(`http://localhost/api/services/${service.id}/status`, { force: true }),
      routeParams(service.id),
    )

    const updated = await db.workCard.findUnique({ where: { id: workCard.id } })
    expect(updated?.status).toBe('IN_PROGRESS')
  })
})
