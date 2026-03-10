import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const saveItemsSchema = z.object({
  checkType: z.enum(["INTAKE", "EXIT"]),
  items: z.array(
    z.object({
      itemName: z.string().min(1),
      status: z.enum(["PRESENT", "MISSING", "RESTOCKED"]),
      explanation: z.string().max(500).nullable().optional(),
    })
  ),
});

const skipSchema = z.object({
  checkType: z.enum(["INTAKE", "EXIT"]),
  note: z.string().max(500).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const serviceId = parseInt(id);

  const service = await db.serviceOrder.findUnique({
    where: { id: serviceId },
    include: {
      equipmentCheckItems: true,
      sections: {
        where: { type: "EQUIPMENT_CHECK" },
        take: 1,
      },
    },
  });

  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const section = service.sections[0] ?? null;
  const equipmentItems = await db.equipmentItem.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });
  const adrItems = service.sections.length > 0 && await db.truck.findUnique({ where: { id: service.truckId }, select: { isAdr: true } })
    ? await db.adrEquipmentItem.findMany({ where: { isActive: true }, orderBy: { order: "asc" } })
    : [];

  return NextResponse.json({
    section,
    equipmentItems,
    adrItems,
    checkItems: service.equipmentCheckItems,
  });
}

export async function POST(request: Request, { params }: Params) {
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

  const parsed = saveItemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const service = await db.serviceOrder.findUnique({ where: { id: serviceId } });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { checkType, items } = parsed.data;

  // Delete existing items of this type, then re-create
  await db.equipmentCheckItem.deleteMany({ where: { serviceOrderId: serviceId, checkType } });
  await db.equipmentCheckItem.createMany({
    data: items.map((item) => ({
      serviceOrderId: serviceId,
      itemName: item.itemName,
      status: item.status,
      explanation: item.explanation ?? null,
      checkType,
    })),
  });

  return NextResponse.json({ ok: true });
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

  const parsed = skipSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const section = await db.serviceSection.findFirst({
    where: { serviceOrderId: serviceId, type: "EQUIPMENT_CHECK" },
  });

  if (!section) return NextResponse.json({ error: "Equipment check section not found" }, { status: 404 });

  const { checkType, note } = parsed.data;
  const data =
    checkType === "INTAKE"
      ? { intakeSkippedAt: new Date(), intakeSkipNote: note ?? null }
      : { exitSkippedAt: new Date(), exitSkipNote: note ?? null };

  const updated = await db.serviceSection.update({ where: { id: section.id }, data });
  return NextResponse.json(updated);
}
