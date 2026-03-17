import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// GET /api/trucks/[id]/service-history?exclude=<serviceId>
export async function GET(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const truckId = Number(id)
  if (isNaN(truckId)) return NextResponse.json({ error: 'Invalid truck ID' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const excludeId = Number(searchParams.get('exclude')) || 0

  const services = await prisma.serviceOrder.findMany({
    where: { truckId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      status: true,
      scheduledDate: true,
      startDate: true,
      endDate: true,
      mileageAtService: true,
      driverNameSnapshot: true,
      cancellationReason: true,
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

  const result = services.map((svc) => {
    const workCards = svc.sections.flatMap((s) => s.workCards)
    const partsCost = workCards
      .flatMap((wc) => wc.parts)
      .reduce((sum, p) => sum + (p.unitCost ?? 0) * p.quantity, 0)

    return {
      id: svc.id,
      status: svc.status,
      scheduledDate: svc.scheduledDate.toISOString(),
      mileageAtService: svc.mileageAtService,
      driverNameSnapshot: svc.driverNameSnapshot,
      cancellationReason: svc.cancellationReason,
      partsCost,
      workCards: workCards.map((wc) => ({
        id: wc.id,
        description: wc.description,
        mechanicName: wc.mechanicName,
        parts: wc.parts.map((p) => ({
          name: p.name,
          quantity: p.quantity,
          unitCost: p.unitCost,
        })),
      })),
    }
  })

  return NextResponse.json({ services: result })
}
