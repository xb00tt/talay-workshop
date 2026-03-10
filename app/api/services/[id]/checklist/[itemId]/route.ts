import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  isCompleted: z.boolean(),
});

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const serviceId = parseInt(id);
  const checklistItemId = parseInt(itemId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await db.serviceChecklistItem.findUnique({
    where: { id: checklistItemId },
    include: { serviceSection: true },
  });

  if (!item || item.serviceSection.serviceOrderId !== serviceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.serviceChecklistItem.update({
    where: { id: checklistItemId },
    data: {
      isCompleted: parsed.data.isCompleted,
      completedAt: parsed.data.isCompleted ? new Date() : null,
      completedByName: parsed.data.isCompleted ? (session.user.name ?? "Unknown") : null,
    },
  });

  return NextResponse.json(updated);
}
