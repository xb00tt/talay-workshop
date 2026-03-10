import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  const mechanics = await db.mechanic.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(mechanics);
}
