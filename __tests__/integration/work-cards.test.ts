import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/prisma', async () => {
  const { db } = await import('./db')
  return { prisma: db }
})

import { getServerSession } from 'next-auth'
import { POST as createWorkCard } from '@/app/api/services/[id]/sections/[sectionId]/work-cards/route'
import { PATCH as patchWorkCard } from '@/app/api/services/[id]/sections/[sectionId]/work-cards/[cardId]/route'
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

function patchReq(url: string, body: unknown) {
  return new Request(url, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

function createParams(serviceId: number, sectionId: number) {
  return { params: Promise.resolve({ id: String(serviceId), sectionId: String(sectionId) }) }
}

function patchParams(serviceId: number, sectionId: number, cardId: number) {
  return { params: Promise.resolve({ id: String(serviceId), sectionId: String(sectionId), cardId: String(cardId) }) }
}

/** Build an IN_PROGRESS service with a MID_SERVICE section ready for work cards. */
async function setupActiveService() {
  const truck = await db.truck.create({
    data: { plateNumber: `W${Date.now()}`, make: 'Scania', model: 'R500', isAdr: false, isActive: true },
  })
  const bay = await db.bay.create({ data: { name: `B${Date.now()}`, isActive: true } })
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
  const checklistSection = await db.serviceSection.create({
    data: { serviceOrderId: service.id, type: 'CHECKLIST', title: 'Checklist', order: 1 },
  })
  const midSection = await db.serviceSection.create({
    data: { serviceOrderId: service.id, type: 'MID_SERVICE', title: 'Допълнителни', order: 2 },
  })
  return { service, checklistSection, midSection }
}

/** Create a work card directly in the DB (for testing status transitions). */
async function seedWorkCard(sectionId: number, status = 'IN_PROGRESS') {
  return db.workCard.create({
    data: { serviceSectionId: sectionId, description: 'Смяна на масло', status: status as never },
  })
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanDb()
  vi.mocked(getServerSession).mockResolvedValue(managerSession())
})

// ─── Work card creation ───────────────────────────────────────────────────────

describe('POST /api/services/[id]/sections/[sectionId]/work-cards — create', () => {
  it('creates a work card with PENDING status on a MID_SERVICE section', async () => {
    const { service, midSection } = await setupActiveService()

    const res = await createWorkCard(
      postReq(`http://localhost/api/services/${service.id}/sections/${midSection.id}/work-cards`, {
        description: 'Проверка на спирачки',
      }),
      createParams(service.id, midSection.id),
    )

    expect(res.status).toBe(201)
    const { workCard } = await res.json()
    expect(workCard.status).toBe('PENDING')
    expect(workCard.description).toBe('Проверка на спирачки')
  })

  it('returns 422 when trying to create a work card on a CHECKLIST section', async () => {
    const { service, checklistSection } = await setupActiveService()

    const res = await createWorkCard(
      postReq(`http://localhost/api/services/${service.id}/sections/${checklistSection.id}/work-cards`, {
        description: 'Тест',
      }),
      createParams(service.id, checklistSection.id),
    )

    expect(res.status).toBe(422)
  })

  it('returns 422 when description is missing', async () => {
    const { service, midSection } = await setupActiveService()

    const res = await createWorkCard(
      postReq(`http://localhost/api/services/${service.id}/sections/${midSection.id}/work-cards`, {}),
      createParams(service.id, midSection.id),
    )

    expect(res.status).toBe(422)
  })

  it('returns 422 when service is COMPLETED', async () => {
    const truck = await db.truck.create({
      data: { plateNumber: `WC${Date.now()}`, make: 'MAN', model: 'TGX', isAdr: false, isActive: true },
    })
    const service = await db.serviceOrder.create({
      data: { truckId: truck.id, truckPlateSnapshot: truck.plateNumber, scheduledDate: new Date(), status: 'COMPLETED', endDate: new Date() },
    })
    const section = await db.serviceSection.create({
      data: { serviceOrderId: service.id, type: 'MID_SERVICE', title: 'Misc', order: 1 },
    })

    const res = await createWorkCard(
      postReq(`http://localhost/api/services/${service.id}/sections/${section.id}/work-cards`, {
        description: 'Тест след приключване',
      }),
      createParams(service.id, section.id),
    )

    expect(res.status).toBe(422)
  })
})

// ─── Work card cancellation ───────────────────────────────────────────────────

describe('PATCH work-card — cancel', () => {
  it('cancels an IN_PROGRESS work card and sets cancelledAt', async () => {
    const { service, midSection } = await setupActiveService()
    const wc = await seedWorkCard(midSection.id)

    const res = await patchWorkCard(
      patchReq(`http://localhost/api/services/${service.id}/sections/${midSection.id}/work-cards/${wc.id}`, {
        status: 'CANCELLED',
      }),
      patchParams(service.id, midSection.id, wc.id),
    )

    expect(res.status).toBe(200)
    const { workCard } = await res.json()
    expect(workCard.status).toBe('CANCELLED')
    expect(workCard.cancelledAt).not.toBeNull()
  })

  it('returns 422 when cancelling an already-cancelled work card', async () => {
    const { service, midSection } = await setupActiveService()
    const wc = await seedWorkCard(midSection.id, 'CANCELLED')

    const res = await patchWorkCard(
      patchReq(`http://localhost/api/services/${service.id}/sections/${midSection.id}/work-cards/${wc.id}`, {
        status: 'CANCELLED',
      }),
      patchParams(service.id, midSection.id, wc.id),
    )

    expect(res.status).toBe(422)
  })

  it('returns 422 when cancelling an already-completed work card', async () => {
    const { service, midSection } = await setupActiveService()
    const wc = await seedWorkCard(midSection.id, 'COMPLETED')

    const res = await patchWorkCard(
      patchReq(`http://localhost/api/services/${service.id}/sections/${midSection.id}/work-cards/${wc.id}`, {
        status: 'CANCELLED',
      }),
      patchParams(service.id, midSection.id, wc.id),
    )

    expect(res.status).toBe(422)
  })
})

// ─── Work card reopen ─────────────────────────────────────────────────────────

describe('PATCH work-card — reopen', () => {
  it('reopens a CANCELLED work card and sets status to IN_PROGRESS', async () => {
    const { service, midSection } = await setupActiveService()
    const wc = await seedWorkCard(midSection.id, 'CANCELLED')

    const res = await patchWorkCard(
      patchReq(`http://localhost/api/services/${service.id}/sections/${midSection.id}/work-cards/${wc.id}`, {
        status: 'REOPEN',
      }),
      patchParams(service.id, midSection.id, wc.id),
    )

    expect(res.status).toBe(200)
    const { workCard } = await res.json()
    expect(workCard.status).toBe('IN_PROGRESS')
    expect(workCard.reopenedAt).not.toBeNull()
    expect(workCard.cancelledAt).toBeNull()
  })

  it('returns 422 when reopening a non-cancelled work card', async () => {
    const { service, midSection } = await setupActiveService()
    const wc = await seedWorkCard(midSection.id, 'IN_PROGRESS')

    const res = await patchWorkCard(
      patchReq(`http://localhost/api/services/${service.id}/sections/${midSection.id}/work-cards/${wc.id}`, {
        status: 'REOPEN',
      }),
      patchParams(service.id, midSection.id, wc.id),
    )

    expect(res.status).toBe(422)
  })
})

// ─── Work card completion ─────────────────────────────────────────────────────

describe('PATCH work-card — complete', () => {
  it('marks an IN_PROGRESS work card as COMPLETED', async () => {
    const { service, midSection } = await setupActiveService()
    const wc = await seedWorkCard(midSection.id)

    const res = await patchWorkCard(
      patchReq(`http://localhost/api/services/${service.id}/sections/${midSection.id}/work-cards/${wc.id}`, {
        status: 'COMPLETED',
      }),
      patchParams(service.id, midSection.id, wc.id),
    )

    expect(res.status).toBe(200)
    expect((await res.json()).workCard.status).toBe('COMPLETED')
  })

  it('returns 422 when completing an already-cancelled work card', async () => {
    const { service, midSection } = await setupActiveService()
    const wc = await seedWorkCard(midSection.id, 'CANCELLED')

    const res = await patchWorkCard(
      patchReq(`http://localhost/api/services/${service.id}/sections/${midSection.id}/work-cards/${wc.id}`, {
        status: 'COMPLETED',
      }),
      patchParams(service.id, midSection.id, wc.id),
    )

    expect(res.status).toBe(422)
  })
})

// ─── Edit guard on closed service ────────────────────────────────────────────

describe('PATCH work-card — closed service guard', () => {
  it('returns 422 when editing a work card on a COMPLETED service', async () => {
    const truck = await db.truck.create({
      data: { plateNumber: `CG${Date.now()}`, make: 'Volvo', model: 'FH', isAdr: false, isActive: true },
    })
    const service = await db.serviceOrder.create({
      data: { truckId: truck.id, truckPlateSnapshot: truck.plateNumber, scheduledDate: new Date(), status: 'COMPLETED', endDate: new Date() },
    })
    const section = await db.serviceSection.create({
      data: { serviceOrderId: service.id, type: 'MID_SERVICE', title: 'Done', order: 1 },
    })
    const wc = await db.workCard.create({
      data: { serviceSectionId: section.id, description: 'Old work', status: 'COMPLETED' },
    })

    const res = await patchWorkCard(
      patchReq(`http://localhost/api/services/${service.id}/sections/${section.id}/work-cards/${wc.id}`, {
        status: 'CANCELLED',
      }),
      patchParams(service.id, section.id, wc.id),
    )

    expect(res.status).toBe(422)
  })
})
