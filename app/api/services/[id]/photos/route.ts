import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/constants";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import sharp from "sharp";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 85;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const serviceId = parseInt(id);

  const photos = await db.photo.findMany({
    where: { serviceOrderId: serviceId, workCardId: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(photos);
}

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "MANAGER") {
    const perms = (session.user.permissions as string[]) ?? [];
    if (!perms.includes(PERMISSIONS.PHOTO_UPLOAD)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { id } = await params;
  const serviceId = parseInt(id);

  const service = await db.serviceOrder.findUnique({ where: { id: serviceId } });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const caption = (formData.get("caption") as string | null) ?? null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const subDir = `services/${serviceId}`;
  const dir = path.join(UPLOADS_DIR, subDir);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.jpg`;
  const filePath = path.join(dir, filename);

  await sharp(buffer)
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(filePath);

  const relativePath = `${subDir}/${filename}`;
  const photo = await db.photo.create({
    data: { serviceOrderId: serviceId, filePath: relativePath, caption },
  });

  return NextResponse.json(photo, { status: 201 });
}
