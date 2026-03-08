import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomBytes } from 'crypto'

type Params = { params: Promise<{ id: string; sectionId: string; cardId: string }> }

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// POST /api/services/[id]/sections/[sectionId]/work-cards/[cardId]/photos
export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, session.user.permissions, 'photo.upload')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id, sectionId, cardId } = await params
  const serviceId = Number(id)
  const secId     = Number(sectionId)
  const wcId      = Number(cardId)

  const workCard = await prisma.workCard.findFirst({
    where: { id: wcId, serviceSectionId: secId, serviceSection: { serviceOrderId: serviceId } },
  })
  if (!workCard) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await request.formData()
  const file     = formData.get('file') as File | null
  const caption  = formData.get('caption') as string | null

  if (!file) return NextResponse.json({ error: 'Не е избран файл.' }, { status: 422 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Позволени формати: JPEG, PNG, GIF, WebP.' }, { status: 422 })
  }

  const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? './uploads')
  const dir        = path.join(uploadsDir, 'work-cards', String(wcId))
  await mkdir(dir, { recursive: true })

  const ext      = path.extname(file.name) || '.jpg'
  const filename = `${randomBytes(8).toString('hex')}${ext}`
  const filePath = path.join('work-cards', String(wcId), filename)
  const absPath  = path.join(uploadsDir, filePath)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(absPath, buffer)

  const photo = await prisma.photo.create({
    data: { workCardId: wcId, filePath, caption: caption?.trim() || null },
  })

  return NextResponse.json({ photo: { ...photo, createdAt: photo.createdAt.toISOString() } }, { status: 201 })
}
