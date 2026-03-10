import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SECTION_TITLES } from "@/lib/constants";
import { auditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// Stage warnings (all warn-not-block per spec)
async function getTransitionWarnings(serviceId: number, toStatus: string): Promise<string[]> {
  const warnings: string[] = [];

  if (toStatus === "IN_PROGRESS") {
    // Warn if intake equipment check not completed or skipped
    const eqSection = await db.serviceSection.findFirst({
      where: { serviceOrderId: serviceId, type: "EQUIPMENT_CHECK" },
    });
    if (eqSection && !eqSection.intakeSkippedAt) {
      const items = await db.equipmentCheckItem.count({
        where: { serviceOrderId: serviceId, checkType: "INTAKE" },
      });
      if (items === 0) warnings.push("intake_equipment_check_incomplete");
    }
  }

  if (toStatus === "QUALITY_CHECK") {
    // Warn if any work cards still Pending/Assigned/InProgress
    const openCards = await db.workCard.count({
      where: {
        serviceSection: { serviceOrderId: serviceId },
        status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
      },
    });
    if (openCards > 0) warnings.push(`open_work_cards:${openCards}`);
  }

  if (toStatus === "READY") {
    // Warn if exit equipment check not completed/skipped or items still missing
    const eqSection = await db.serviceSection.findFirst({
      where: { serviceOrderId: serviceId, type: "EQUIPMENT_CHECK" },
    });
    if (eqSection && !eqSection.exitSkippedAt) {
      const exitItems = await db.equipmentCheckItem.count({
        where: { serviceOrderId: serviceId, checkType: "EXIT" },
      });
      if (exitItems === 0) warnings.push("exit_equipment_check_incomplete");
      else {
        const missingItems = await db.equipmentCheckItem.count({
          where: { serviceOrderId: serviceId, checkType: "EXIT", status: "MISSING" },
        });
        if (missingItems > 0) warnings.push(`missing_equipment_items:${missingItems}`);
      }
    }
  }

  return warnings;
}

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const serviceId = parseInt(id);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // empty body is ok
  }

  const toStatus = body.status as string;
  const skipWarning = body.skipWarning === true;
  const validStatuses = ["INTAKE", "IN_PROGRESS", "QUALITY_CHECK", "READY", "COMPLETED"];

  if (!validStatuses.includes(toStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const service = await db.serviceOrder.findUnique({
    where: { id: serviceId },
    include: { truck: true },
  });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Validate flow order
  const flow = ["SCHEDULED", "INTAKE", "IN_PROGRESS", "QUALITY_CHECK", "READY", "COMPLETED"];
  const currentIdx = flow.indexOf(service.status);
  const toIdx = flow.indexOf(toStatus);
  if (toIdx !== currentIdx + 1) {
    return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
  }

  // Get warnings (unless skipWarning flag is set)
  if (!skipWarning && toStatus !== "COMPLETED") {
    const warnings = await getTransitionWarnings(serviceId, toStatus);
    if (warnings.length > 0) {
      return NextResponse.json({ warnings }, { status: 200 });
    }
  }

  // Build update data
  const updateData: Record<string, unknown> = { status: toStatus };

  if (toStatus === "INTAKE") {
    // Require bayId
    const bayId = body.bayId as number | undefined;
    if (!bayId) return NextResponse.json({ error: "bayId required for INTAKE" }, { status: 400 });

    // Hard block: bay must not be occupied
    const bayOccupied = await db.serviceOrder.findFirst({
      where: {
        bayId,
        status: { notIn: ["COMPLETED", "CANCELLED", "SCHEDULED"] },
        id: { not: serviceId },
      },
    });
    if (bayOccupied) return NextResponse.json({ error: "bay_occupied" }, { status: 409 });

    const bayRecord = await db.bay.findUnique({ where: { id: bayId } });

    updateData.bayId = bayId;
    updateData.bayNameSnapshot = bayRecord?.name ?? String(bayId);
    updateData.startDate = new Date();

    // Mileage at service (from body or truck's current)
    if (body.mileageAtService != null) {
      updateData.mileageAtService = body.mileageAtService;
    } else if (service.truck.currentMileage) {
      updateData.mileageAtService = service.truck.currentMileage;
    }

    // Driver snapshot
    if (body.driverId != null) {
      const driver = await db.driver.findUnique({ where: { id: body.driverId as number } });
      updateData.driverId = body.driverId;
      updateData.driverNameSnapshot = driver?.name ?? null;
    }

    // Auto-create CHECKLIST and EQUIPMENT_CHECK sections
    const [, checklistTemplate] = await Promise.all([
      db.serviceSection.create({
        data: {
          serviceOrderId: serviceId,
          type: "EQUIPMENT_CHECK",
          title: SECTION_TITLES.EQUIPMENT_CHECK,
          order: 0,
        },
      }),
      db.checklistTemplate.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
      }),
    ]);

    // Copy active checklist template items to service checklist section
    const checklistSection = await db.serviceSection.create({
      data: {
        serviceOrderId: serviceId,
        type: "CHECKLIST",
        title: SECTION_TITLES.CHECKLIST,
        order: 1,
      },
    });

    if (checklistTemplate.length > 0) {
      await db.serviceChecklistItem.createMany({
        data: checklistTemplate.map((item) => ({
          serviceSectionId: checklistSection.id,
          description: item.description,
        })),
      });
    }
  }

  if (toStatus === "IN_PROGRESS") {
    // Auto-advance all PENDING work cards to IN_PROGRESS
    await db.workCard.updateMany({
      where: {
        serviceSection: { serviceOrderId: serviceId },
        status: "PENDING",
      },
      data: { status: "IN_PROGRESS" },
    });
  }

  if (toStatus === "COMPLETED") {
    updateData.endDate = new Date();

    // Save equipment snapshot
    const exitItems = await db.equipmentCheckItem.findMany({
      where: { serviceOrderId: serviceId, checkType: "EXIT" },
    });
    const intakeItems = await db.equipmentCheckItem.findMany({
      where: { serviceOrderId: serviceId, checkType: "INTAKE" },
    });
    const snapshotItems = exitItems.length > 0 ? exitItems : intakeItems;

    if (snapshotItems.length > 0) {
      const snapshot = await db.truckEquipmentSnapshot.create({
        data: { truckId: service.truckId, serviceOrderId: serviceId },
      });
      await db.truckEquipmentSnapshotItem.createMany({
        data: snapshotItems.map((item) => ({
          snapshotId: snapshot.id,
          itemName: item.itemName,
          status: item.status,
        })),
      });
    }
  }

  const updated = await db.serviceOrder.update({
    where: { id: serviceId },
    data: updateData,
  });

  await auditLog({
    userId: parseInt(session.user.id),
    userName: session.user.name ?? "Unknown",
    action: "STATUS_CHANGE",
    entityType: "ServiceOrder",
    entityId: serviceId,
    oldValue: { status: service.status },
    newValue: { status: toStatus },
  });

  return NextResponse.json(updated);
}
