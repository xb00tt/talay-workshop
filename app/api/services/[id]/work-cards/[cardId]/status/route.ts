import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";

const schema = z.object({
  status: z.enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
});

type Params = { params: Promise<{ id: string; cardId: string }> };

export async function POST(request: Request, { params }: Params) {
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const newStatus = parsed.data.status;

  // Permission check for complete
  if (newStatus === "COMPLETED" && session.user.role !== "MANAGER") {
    const perms = (session.user.permissions as string[]) ?? [];
    if (!perms.includes(PERMISSIONS.WORKCARD_COMPLETE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const card = await db.workCard.findUnique({
    where: { id: workCardId },
    include: { serviceSection: true },
  });

  if (!card || card.serviceSection.serviceOrderId !== serviceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Rules
  if (card.status === "CANCELLED" && newStatus !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Cancelled cards can only be reopened" }, { status: 400 });
  }
  if (card.status === "COMPLETED") {
    return NextResponse.json({ error: "Completed cards cannot be changed" }, { status: 400 });
  }

  const data: Record<string, unknown> = { status: newStatus };
  if (newStatus === "CANCELLED") data.cancelledAt = new Date();
  if (newStatus === "IN_PROGRESS" && card.status === "CANCELLED") data.reopenedAt = new Date();

  const updated = await db.workCard.update({
    where: { id: workCardId },
    data,
  });

  await auditLog({
    userId: parseInt(session.user.id),
    userName: session.user.name ?? "Unknown",
    action: "STATUS_CHANGE",
    entityType: "WorkCard",
    entityId: workCardId,
    oldValue: { status: card.status },
    newValue: { status: newStatus },
  });

  return NextResponse.json(updated);
}
