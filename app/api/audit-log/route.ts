import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/audit-log?page=1&pageSize=50&search=...
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url      = new URL(request.url)
  const page     = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
  const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get('pageSize') ?? '50')))
  const search   = url.searchParams.get('search')?.trim() ?? ''

  const where = search
    ? {
        OR: [
          { action:           { contains: search } },
          { entityType:       { contains: search } },
          { userNameSnapshot: { contains: search } },
        ],
      }
    : {}

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({
    logs: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
  })
}
