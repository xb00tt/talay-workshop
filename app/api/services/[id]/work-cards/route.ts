import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createWorkCardSchema } from "@/lib/schemas/workCard";
import { auditLog } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "MANAGER") {
    const perms = (session.user.permissions as string[]) ?? [];
    if (!perms.includes(PERMISSIONS.WORKCARD_CREATE)) {
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

  const parsed = createWorkCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verify section belongs to this service
  const section = await db.serviceSection.findUnique({
    where: { id: parsed.data.serviceSectionId },
  });
  if (!section || section.serviceOrderId !== serviceId) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const service = await db.serviceOrder.findUnique({ where: { id: serviceId } });
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });
  if (service.status === "COMPLETED" || service.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot add work card to a closed service" }, { status: 400 });
  }

  // If service is already IN_PROGRESS, card starts as PENDING (manager advances manually)
  const card = await db.workCard.create({
    data: {
      serviceSectionId: parsed.data.serviceSectionId,
      description: parsed.data.description,
      mechanicId: parsed.data.mechanicId ?? null,
      mechanicName: parsed.data.mechanicName,
      specialInstructions: parsed.data.specialInstructions ?? null,
      status: "PENDING",
    },
  });

  await auditLog({
    userId: parseInt(session.user.id),
    userName: session.user.name ?? "Unknown",
    action: "CREATE",
    entityType: "WorkCard",
    entityId: card.id,
    newValue: { description: card.description, mechanicName: card.mechanicName },
  });

  return NextResponse.json(card, { status: 201 });
}
