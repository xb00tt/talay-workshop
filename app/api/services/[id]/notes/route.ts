import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/constants";

const createNoteSchema = z.object({
  content: z.string().min(1).max(2000),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "MANAGER") {
    const perms = (session.user.permissions as string[]) ?? [];
    if (!perms.includes(PERMISSIONS.NOTE_CREATE)) {
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

  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const service = await db.serviceOrder.findUnique({ where: { id: serviceId } });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const note = await db.note.create({
    data: {
      serviceOrderId: serviceId,
      content: parsed.data.content,
      userId: parseInt(session.user.id),
      userNameSnapshot: session.user.name ?? "Unknown",
    },
  });

  return NextResponse.json(note, { status: 201 });
}
