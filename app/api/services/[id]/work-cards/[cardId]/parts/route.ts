import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { addPartSchema } from "@/lib/schemas/part";

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

  const parsed = addPartSchema.safeParse(body);
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

  const part = await db.part.create({
    data: { workCardId, ...parsed.data },
  });

  return NextResponse.json(part, { status: 201 });
}
