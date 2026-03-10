import { db } from "@/lib/db";

interface AuditParams {
  userId?: number | null;
  userName: string;
  action: string;
  entityType: string;
  entityId: string | number;
  oldValue?: unknown;
  newValue?: unknown;
}

export async function auditLog(params: AuditParams) {
  await db.auditLog.create({
    data: {
      userId: params.userId ?? null,
      userNameSnapshot: params.userName,
      action: params.action,
      entityType: params.entityType,
      entityId: String(params.entityId),
      oldValue: params.oldValue != null ? JSON.stringify(params.oldValue) : null,
      newValue: params.newValue != null ? JSON.stringify(params.newValue) : null,
    },
  });
}
