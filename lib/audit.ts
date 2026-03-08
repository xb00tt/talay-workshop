import { prisma } from './prisma'

interface AuditParams {
  userId:          number | null
  userNameSnapshot: string
  action:          string
  entityType:      string
  entityId:        string | number
  oldValue?:       object | null
  newValue?:       object | null
}

export async function logAudit(p: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId:           p.userId,
        userNameSnapshot: p.userNameSnapshot,
        action:           p.action,
        entityType:       p.entityType,
        entityId:         String(p.entityId),
        oldValue:         p.oldValue  ? JSON.stringify(p.oldValue)  : null,
        newValue:         p.newValue  ? JSON.stringify(p.newValue)  : null,
      },
    })
  } catch {
    // Audit failures must never break the primary operation
  }
}

// Convenience: extract user info from a NextAuth session object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function auditActor(session: any): { userId: number | null; userNameSnapshot: string } {
  return {
    userId:           session?.user?.id ? Number(session.user.id) : null,
    userNameSnapshot: session?.user?.name ?? 'Unknown',
  }
}
