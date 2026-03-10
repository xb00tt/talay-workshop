import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import path from "path";
import fs from "fs/promises";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

type Params = { params: Promise<{ id: string; photoId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, photoId } = await params;
  const serviceId = parseInt(id);
  const photoIdInt = parseInt(photoId);

  const photo = await db.photo.findUnique({ where: { id: photoIdInt } });
  if (!photo || photo.serviceOrderId !== serviceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.photo.delete({ where: { id: photoIdInt } });

  try {
    await fs.unlink(path.join(UPLOADS_DIR, photo.filePath));
  } catch {
    // File already gone — ignore
  }

  return new NextResponse(null, { status: 204 });
}
