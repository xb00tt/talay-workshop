import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createTruckSchema } from "@/lib/schemas/truck";
import { auditLog } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "10")));
  const search = searchParams.get("search") ?? "";
  const includeInactive = searchParams.get("includeInactive") === "true";

  const where = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(search
      ? {
          OR: [
            { plateNumber: { contains: search } },
            { make: { contains: search } },
            { model: { contains: search } },
          ],
        }
      : {}),
  };

  const [trucks, total] = await Promise.all([
    db.truck.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { plateNumber: "asc" },
    }),
    db.truck.count({ where }),
  ]);

  return NextResponse.json({ trucks, total, page, pageSize });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "MANAGER") {
    const perms = (session.user.permissions as string[]) ?? [];
    if (!perms.includes(PERMISSIONS.TRUCK_CREATE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createTruckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db.truck.findUnique({ where: { plateNumber: parsed.data.plateNumber } });
  if (existing) {
    return NextResponse.json({ error: "Plate number already exists" }, { status: 409 });
  }

  const truck = await db.truck.create({ data: parsed.data });

  await auditLog({
    userId: parseInt(session.user.id),
    userName: session.user.name ?? "Unknown",
    action: "CREATE",
    entityType: "Truck",
    entityId: truck.id,
    newValue: truck,
  });

  return NextResponse.json(truck, { status: 201 });
}
