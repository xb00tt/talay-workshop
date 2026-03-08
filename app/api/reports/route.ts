import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

// GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&truckId=123
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'report.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url     = new URL(request.url)
  const fromStr = url.searchParams.get('from')
  const toStr   = url.searchParams.get('to')
  const truckId = url.searchParams.get('truckId')

  const fromDate = fromStr ? new Date(fromStr) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const toDate   = toStr   ? new Date(toStr)   : new Date()
  toDate.setHours(23, 59, 59, 999)

  const where: Record<string, unknown> = {
    status:  'COMPLETED',
    endDate: { gte: fromDate, lte: toDate },
  }
  if (truckId) where.truckId = Number(truckId)

  const services = await prisma.serviceOrder.findMany({
    where,
    orderBy: { endDate: 'asc' },
    include: {
      truck: { select: { id: true, plateNumber: true, make: true, model: true } },
      sections: {
        include: {
          workCards: {
            where: { status: 'COMPLETED' },
            include: { parts: true },
          },
        },
      },
    },
  })

  // ── Build summary rows ────────────────────────────────────────────────────

  const rows = services.map((svc) => {
    const allParts = svc.sections.flatMap((s) => s.workCards).flatMap((wc) => wc.parts)
    const partsCost = allParts.reduce((sum, p) => sum + (p.unitCost ?? 0) * p.quantity, 0)
    const daysInWorkshop = svc.startDate && svc.endDate
      ? Math.round((svc.endDate.getTime() - svc.startDate.getTime()) / (1000 * 60 * 60 * 24) * 10) / 10
      : null

    return {
      serviceId:       svc.id,
      plate:           svc.truckPlateSnapshot,
      truckId:         svc.truckId,
      make:            svc.truck.make,
      model:           svc.truck.model,
      scheduledDate:   svc.scheduledDate.toISOString().slice(0, 10),
      startDate:       svc.startDate?.toISOString().slice(0, 10) ?? null,
      endDate:         svc.endDate?.toISOString().slice(0, 10) ?? null,
      mileageAtService: svc.mileageAtService,
      daysInWorkshop,
      partsCost:       Math.round(partsCost * 100) / 100,
      workCardCount:   svc.sections.flatMap((s) => s.workCards).length,
    }
  })

  // ── Aggregations ──────────────────────────────────────────────────────────

  // Per-truck summary
  const truckMap = new Map<number, {
    truckId: number; plate: string; make: string; model: string
    serviceCount: number; totalPartsCost: number; totalDays: number
  }>()
  for (const row of rows) {
    const existing = truckMap.get(row.truckId)
    if (existing) {
      existing.serviceCount++
      existing.totalPartsCost += row.partsCost
      existing.totalDays += row.daysInWorkshop ?? 0
    } else {
      truckMap.set(row.truckId, {
        truckId: row.truckId, plate: row.plate, make: row.make, model: row.model,
        serviceCount: 1, totalPartsCost: row.partsCost, totalDays: row.daysInWorkshop ?? 0,
      })
    }
  }

  // Parts usage
  const partsMap = new Map<string, { name: string; totalQty: number; totalCost: number }>()
  for (const svc of services) {
    for (const sec of svc.sections) {
      for (const wc of sec.workCards) {
        for (const p of wc.parts) {
          const existing = partsMap.get(p.name)
          if (existing) {
            existing.totalQty  += p.quantity
            existing.totalCost += (p.unitCost ?? 0) * p.quantity
          } else {
            partsMap.set(p.name, { name: p.name, totalQty: p.quantity, totalCost: (p.unitCost ?? 0) * p.quantity })
          }
        }
      }
    }
  }

  return NextResponse.json({
    from:    fromDate.toISOString().slice(0, 10),
    to:      toDate.toISOString().slice(0, 10),
    rows,
    truckSummary: [...truckMap.values()].sort((a, b) => b.totalPartsCost - a.totalPartsCost),
    partsSummary: [...partsMap.values()].sort((a, b) => b.totalCost - a.totalCost),
    totals: {
      services:   rows.length,
      partsCost:  Math.round(rows.reduce((s, r) => s + r.partsCost, 0) * 100) / 100,
      avgDays:    rows.length
        ? Math.round(rows.reduce((s, r) => s + (r.daysInWorkshop ?? 0), 0) / rows.length * 10) / 10
        : 0,
    },
  })
}
