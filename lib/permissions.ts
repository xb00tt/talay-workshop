import { auth } from "@/auth";
import type { PermissionAction } from "@/lib/constants";

/** Returns true if the current session user has the given permission action. */
export async function hasPermission(action: PermissionAction): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  // Managers always have full access
  if (session.user.role === "MANAGER") return true;

  const perms = (session.user.permissions as string[]) ?? [];
  return perms.includes(action);
}

/** Throws a 403 response if the user does not have the given permission. */
export async function requirePermission(action: PermissionAction): Promise<void> {
  const ok = await hasPermission(action);
  if (!ok) {
    throw new Response("Forbidden", { status: 403 });
  }
}

/** Returns true if the current session user is a manager. */
export async function isManager(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "MANAGER";
}
