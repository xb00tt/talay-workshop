import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createServiceSchema } from "@/lib/schemas/service";
import { auditLog } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = parseInt(searchParams.get("pageSize") ?? "10");
  const status = searchParams.get("status");
  const truckId = searchParams.get("truckId");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (truckId) where.truckId = parseInt(truckId);
  if (search) {
    where.truckPlateSnapshot = { contains: search.toUpperCase() };
  }

  const [services, total] = await Promise.all([
    db.serviceOrder.findMany({
      where,
      include: {
        truck: { select: { plateNumber: true, make: true, model: true } },
        bay: { select: { name: true } },
      },
      orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.serviceOrder.count({ where }),
  ]);

  return NextResponse.json({ services, total, page, pageSize });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Permission check: service.create
  if (session.user.role !== "MANAGER") {
    const perms = (session.user.permissions as string[]) ?? [];
    if (!perms.includes(PERMISSIONS.SERVICE_CREATE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { truckId, scheduledDate, driverId } = parsed.data;

  // Hard block: truck must exist and be active
  const truck = await db.truck.findUnique({ where: { id: truckId } });
  if (!truck || !truck.isActive) {
    return NextResponse.json({ error: "truck_not_found" }, { status: 404 });
  }

  // Hard block: one active service per truck
  const existingActive = await db.serviceOrder.findFirst({
    where: {
      truckId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
  });
  if (existingActive) {
    return NextResponse.json({ error: "truck_has_active_service" }, { status: 409 });
  }

  // Resolve driver snapshot
  let driverNameSnapshot: string | null = null;
  if (driverId) {
    const driver = await db.driver.findUnique({ where: { id: driverId } });
    driverNameSnapshot = driver?.name ?? null;
  }

  const service = await db.serviceOrder.create({
    data: {
      truckId,
      truckPlateSnapshot: truck.plateNumber,
      status: "SCHEDULED",
      scheduledDate: new Date(scheduledDate),
      driverId: driverId ?? null,
      driverNameSnapshot,
    },
  });

  await auditLog({
    userId: parseInt(session.user.id),
    userName: session.user.name ?? "Unknown",
    action: "CREATE",
    entityType: "ServiceOrder",
    entityId: service.id,
    newValue: { truckPlate: truck.plateNumber, scheduledDate },
  });

  return NextResponse.json(service, { status: 201 });
}
