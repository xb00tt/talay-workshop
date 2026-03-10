import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cancelServiceSchema } from "@/lib/schemas/service";
import { auditLog } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only managers can cancel
  if (session.user.role !== "MANAGER") {
    const perms = (session.user.permissions as string[]) ?? [];
    if (!perms.includes(PERMISSIONS.SERVICE_CANCEL)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { id } = await params;
  const serviceId = parseInt(id);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = cancelServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const service = await db.serviceOrder.findUnique({ where: { id: serviceId } });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (service.status === "COMPLETED" || service.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot cancel a completed or already cancelled service" }, { status: 400 });
  }

  const updated = await db.serviceOrder.update({
    where: { id: serviceId },
    data: {
      status: "CANCELLED",
      cancellationReason: parsed.data.cancellationReason,
      endDate: new Date(),
    },
  });

  await auditLog({
    userId: parseInt(session.user.id),
    userName: session.user.name ?? "Unknown",
    action: "CANCEL",
    entityType: "ServiceOrder",
    entityId: serviceId,
    oldValue: { status: service.status },
    newValue: { status: "CANCELLED", reason: parsed.data.cancellationReason },
  });

  return NextResponse.json(updated);
}
