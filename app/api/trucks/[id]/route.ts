import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { updateTruckSchema } from "@/lib/schemas/truck";
import { auditLog } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const truckId = parseInt(id);

  const truck = await db.truck.findUnique({
    where: { id: truckId },
    include: {
      services: {
        orderBy: { scheduledDate: "desc" },
        take: 20,
      },
      equipmentSnapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { items: true },
      },
    },
  });

  if (!truck) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(truck);
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "MANAGER") {
    const perms = (session.user.permissions as string[]) ?? [];
    const hasEdit = perms.includes(PERMISSIONS.TRUCK_EDIT);
    const hasDeactivate = perms.includes(PERMISSIONS.TRUCK_DEACTIVATE);
    if (!hasEdit && !hasDeactivate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { id } = await params;
  const truckId = parseInt(id);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateTruckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const truck = await db.truck.findUnique({ where: { id: truckId } });
  if (!truck) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If updating plate number, check uniqueness
  if (parsed.data.plateNumber && parsed.data.plateNumber !== truck.plateNumber) {
    const conflict = await db.truck.findUnique({ where: { plateNumber: parsed.data.plateNumber } });
    if (conflict) return NextResponse.json({ error: "Plate number already exists" }, { status: 409 });
  }

  const updated = await db.truck.update({ where: { id: truckId }, data: parsed.data });

  await auditLog({
    userId: parseInt(session.user.id),
    userName: session.user.name ?? "Unknown",
    action: "UPDATE",
    entityType: "Truck",
    entityId: truckId,
    oldValue: truck,
    newValue: updated,
  });

  return NextResponse.json(updated);
}
