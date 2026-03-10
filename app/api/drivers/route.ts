import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") ?? "10")));
  const search = searchParams.get("search") ?? "";
  const includeInactive = searchParams.get("includeInactive") === "true";

  const where = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(search ? { name: { contains: search } } : {}),
  };

  const [drivers, total] = await Promise.all([
    db.driver.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: "asc" },
    }),
    db.driver.count({ where }),
  ]);

  return NextResponse.json({ drivers, total, page, pageSize });
}
