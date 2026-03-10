import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rescheduleServiceSchema } from "@/lib/schemas/service";
import { auditLog } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const serviceId = parseInt(id);

  const service = await db.serviceOrder.findUnique({
    where: { id: serviceId },
    include: {
      truck: true,
      bay: true,
      driver: true,
      sections: {
        include: {
          checklistItems: true,
          workCards: {
            include: {
              mechanic: true,
              parts: true,
              notes: { orderBy: { createdAt: "asc" } },
              photos: { orderBy: { createdAt: "desc" } },
            },
          },
        },
        orderBy: { order: "asc" },
      },
      equipmentCheckItems: true,
      driverFeedbackItems: { orderBy: { order: "asc" } },
      photos: { orderBy: { createdAt: "desc" } },
      notes: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(service);
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const serviceId = parseInt(id);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = rescheduleServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Permission: service.reschedule
  if (session.user.role !== "MANAGER") {
    const perms = (session.user.permissions as string[]) ?? [];
    if (!perms.includes(PERMISSIONS.SERVICE_RESCHEDULE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const service = await db.serviceOrder.findUnique({ where: { id: serviceId } });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (service.status !== "SCHEDULED") {
    return NextResponse.json({ error: "Only SCHEDULED services can be rescheduled" }, { status: 400 });
  }

  const old = service.scheduledDate;
  const updated = await db.serviceOrder.update({
    where: { id: serviceId },
    data: { scheduledDate: new Date(parsed.data.scheduledDate) },
  });

  await auditLog({
    userId: parseInt(session.user.id),
    userName: session.user.name ?? "Unknown",
    action: "RESCHEDULE",
    entityType: "ServiceOrder",
    entityId: serviceId,
    oldValue: { scheduledDate: old },
    newValue: { scheduledDate: parsed.data.scheduledDate },
  });

  return NextResponse.json(updated);
}
