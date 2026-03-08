import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import path from 'path'

type Params = { params: Promise<{ id: string; photoId: string }> }

// DELETE /api/services/[id]/photos/[photoId]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, photoId } = await params
  const serviceId = Number(id)
  const pId       = Number(photoId)

  const photo = await prisma.photo.findFirst({
    where: { id: pId, serviceOrderId: serviceId },
  })
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete file from filesystem
  try {
    const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? './uploads')
    await unlink(path.join(uploadsDir, photo.filePath))
  } catch {
    // File may already be gone — proceed with DB deletion
  }

  await prisma.photo.delete({ where: { id: pId } })
  return NextResponse.json({ success: true })
}
