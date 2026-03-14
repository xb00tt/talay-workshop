import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_LOGO_SIZE = 2 * 1024 * 1024  // 2 MB
const EXT_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/gif':  '.gif',
  'image/webp': '.webp',
}

// POST /api/settings/logo — upload company logo
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('logo') as File | null
  if (!file || !file.size) {
    return NextResponse.json({ error: 'Файлът е задължителен.' }, { status: 422 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Само JPG, PNG, GIF или WebP.' }, { status: 422 })
  }
  if (file.size > MAX_LOGO_SIZE) {
    return NextResponse.json({ error: 'Логото е прекалено голямо. Максимум 2 MB.' }, { status: 413 })
  }

  const ext = EXT_MAP[file.type] ?? '.jpg'
  const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? './uploads')
  const logoDir = path.join(uploadsDir, 'logo')
  await mkdir(logoDir, { recursive: true })

  const filename = `logo${ext}`
  await writeFile(path.join(logoDir, filename), Buffer.from(await file.arrayBuffer()))

  const logoPath = `logo/${filename}`
  await prisma.settings.update({ where: { id: 1 }, data: { logoPath } })

  return NextResponse.json({ logoPath })
}
