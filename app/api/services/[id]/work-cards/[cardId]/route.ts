import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { updateWorkCardSchema } from "@/lib/schemas/workCard";
import { auditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string; cardId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, cardId } = await params;
  const serviceId = parseInt(id);
  const workCardId = parseInt(cardId);

  const card = await db.workCard.findUnique({
    where: { id: workCardId },
    include: {
      serviceSection: { include: { serviceOrder: { include: { truck: true } } } },
      parts: { orderBy: { id: "asc" } },
      notes: { orderBy: { createdAt: "asc" } },
      photos: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!card || card.serviceSection.serviceOrderId !== serviceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(card);
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, cardId } = await params;
  const serviceId = parseInt(id);
  const workCardId = parseInt(cardId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateWorkCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const card = await db.workCard.findUnique({
    where: { id: workCardId },
    include: { serviceSection: true },
  });

  if (!card || card.serviceSection.serviceOrderId !== serviceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (card.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot edit a cancelled work card" }, { status: 400 });
  }

  const updated = await db.workCard.update({
    where: { id: workCardId },
    data: parsed.data,
  });

  await auditLog({
    userId: parseInt(session.user.id),
    userName: session.user.name ?? "Unknown",
    action: "UPDATE",
    entityType: "WorkCard",
    entityId: workCardId,
    oldValue: card,
    newValue: updated,
  });

  return NextResponse.json(updated);
}
