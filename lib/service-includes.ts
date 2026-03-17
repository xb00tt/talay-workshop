import { Prisma } from './generated/prisma/client'

/**
 * Shared Prisma include for loading a full service order with all relations.
 * Used by: GET /api/services/[id], status route, intake route, and page.tsx.
 */
export const SERVICE_FULL_INCLUDE = {
  truck:    { select: { id: true, make: true, model: true, year: true, isAdr: true, frotcomVehicleId: true } },
  driver:   { select: { id: true, name: true } },
  sections: {
    orderBy:  { order: 'asc' as const },
    include: {
      checklistItems: true,
      workCards: {
        include: {
          mechanic: { select: { id: true, name: true } },
          parts:    true,
          notes:    { orderBy: { createdAt: 'asc' as const } },
          photos:   true,
        },
      },
    },
  },
  equipmentCheckItems: true,
  driverFeedbackItems:   { orderBy: { order: 'asc' as const } },
  mechanicFeedbackItems: { orderBy: { order: 'asc' as const } },
  notes:  { orderBy: { createdAt: 'asc' as const } },
  photos: true,
} satisfies Prisma.ServiceOrderInclude
