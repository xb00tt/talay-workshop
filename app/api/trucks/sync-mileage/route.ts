import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncFrotcomMileage } from '@/lib/frotcom'

// POST /api/trucks/sync-mileage — manual mileage sync for all Frotcom trucks
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await syncFrotcomMileage()
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
