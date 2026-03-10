import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DASHBOARD_QUEUE_SIZE } from "@/lib/constants";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [activeServices, upcomingServices, mileageAlerts] = await Promise.all([
    // Active services (all non-terminal statuses except SCHEDULED)
    db.serviceOrder.findMany({
      where: {
        status: { in: ["INTAKE", "IN_PROGRESS", "QUALITY_CHECK", "READY"] },
      },
      include: {
        truck: { select: { plateNumber: true, make: true, model: true } },
        bay: { select: { name: true } },
      },
      orderBy: { startDate: "asc" },
    }),

    // Upcoming scheduled services (cap at DASHBOARD_QUEUE_SIZE)
    db.serviceOrder.findMany({
      where: { status: "SCHEDULED" },
      include: {
        truck: { select: { plateNumber: true, make: true, model: true } },
      },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
      take: DASHBOARD_QUEUE_SIZE,
    }),

    // Trucks with mileage alerts (currentMileage known, last service mileage known)
    db.truck.findMany({
      where: { isActive: true, currentMileage: { not: null } },
      select: {
        id: true,
        plateNumber: true,
        make: true,
        model: true,
        currentMileage: true,
        mileageTriggerKm: true,
        services: {
          where: { status: "COMPLETED", mileageAtService: { not: null } },
          orderBy: { endDate: "desc" },
          take: 1,
          select: { mileageAtService: true, endDate: true },
        },
      },
    }),
  ]);

  // Filter trucks that actually have a mileage alert
  const alerts = mileageAlerts
    .filter((truck) => {
      const lastService = truck.services[0];
      if (!truck.currentMileage) return false;
      const baseline = lastService?.mileageAtService ?? 0;
      const kmSince = truck.currentMileage - baseline;
      return kmSince >= truck.mileageTriggerKm;
    })
    .map((truck) => {
      const lastService = truck.services[0];
      const baseline = lastService?.mileageAtService ?? 0;
      return {
        id: truck.id,
        plateNumber: truck.plateNumber,
        make: truck.make,
        model: truck.model,
        currentMileage: truck.currentMileage,
        kmSinceService: Math.round((truck.currentMileage ?? 0) - baseline),
        mileageTriggerKm: truck.mileageTriggerKm,
        lastServiceDate: lastService?.endDate ?? null,
      };
    });

  return NextResponse.json({ activeServices, upcomingServices, alerts });
}
