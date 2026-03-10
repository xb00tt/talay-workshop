import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/constants";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import sharp from "sharp";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

type Params = { params: Promise<{ id: string; cardId: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "MANAGER") {
    const perms = (session.user.permissions as string[]) ?? [];
    if (!perms.includes(PERMISSIONS.PHOTO_UPLOAD)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { id, cardId } = await params;
  const serviceId = parseInt(id);
  const workCardId = parseInt(cardId);

  const card = await db.workCard.findUnique({
    where: { id: workCardId },
    include: { serviceSection: true },
  });
  if (!card || card.serviceSection.serviceOrderId !== serviceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const caption = (formData.get("caption") as string | null) ?? null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const subDir = `services/${serviceId}/work-cards/${workCardId}`;
  const dir = path.join(UPLOADS_DIR, subDir);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.jpg`;
  await sharp(buffer)
    .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(path.join(dir, filename));

  const photo = await db.photo.create({
    data: {
      serviceOrderId: serviceId,
      workCardId,
      filePath: `${subDir}/${filename}`,
      caption,
    },
  });

  return NextResponse.json(photo, { status: 201 });
}
