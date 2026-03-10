import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { updatePartSchema } from "@/lib/schemas/part";

type Params = { params: Promise<{ id: string; cardId: string; partId: string }> };

async function resolvePart(serviceId: number, workCardId: number, partIdInt: number) {
  const part = await db.part.findUnique({ where: { id: partIdInt } });
  if (!part || part.workCardId !== workCardId) return null;
  const card = await db.workCard.findUnique({
    where: { id: workCardId },
    include: { serviceSection: true },
  });
  if (!card || card.serviceSection.serviceOrderId !== serviceId) return null;
  return part;
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, cardId, partId } = await params;
  const part = await resolvePart(parseInt(id), parseInt(cardId), parseInt(partId));
  if (!part) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updatePartSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await db.part.update({ where: { id: part.id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, cardId, partId } = await params;
  const part = await resolvePart(parseInt(id), parseInt(cardId), parseInt(partId));
  if (!part) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.part.delete({ where: { id: part.id } });
  return new NextResponse(null, { status: 204 });
}
