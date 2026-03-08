import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import path from 'path'

type Params = { params: Promise<{ id: string; sectionId: string; cardId: string; photoId: string }> }

// DELETE /api/services/[id]/sections/[sectionId]/work-cards/[cardId]/photos/[photoId]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, sectionId, cardId, photoId } = await params
  const serviceId = Number(id)
  const secId     = Number(sectionId)
  const wcId      = Number(cardId)
  const pId       = Number(photoId)

  const photo = await prisma.photo.findFirst({
    where: {
      id:       pId,
      workCardId: wcId,
      workCard: { serviceSectionId: secId, serviceSection: { serviceOrderId: serviceId } },
    },
  })
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? './uploads')
    await unlink(path.join(uploadsDir, photo.filePath))
  } catch { /* file may be gone already */ }

  await prisma.photo.delete({ where: { id: pId } })
  return NextResponse.json({ success: true })
}
