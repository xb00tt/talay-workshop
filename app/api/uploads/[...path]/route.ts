import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readFile } from 'fs/promises'
import path from 'path'

const CONTENT_TYPES: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
}

// GET /api/uploads/[...path] — serve files from UPLOADS_DIR
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })
  const { path: segments } = await params
  const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? './uploads')
  const filePath   = path.resolve(path.join(uploadsDir, ...segments))

  // Prevent path traversal
  if (!filePath.startsWith(uploadsDir + path.sep)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  try {
    const file = await readFile(filePath)
    const ext  = path.extname(filePath).toLowerCase()
    return new NextResponse(file, {
      headers: {
        'Content-Type':  CONTENT_TYPES[ext] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
