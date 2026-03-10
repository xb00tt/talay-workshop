import { DATE_FORMAT, CURRENCY } from "@/lib/constants";

/** Format a Date (or ISO string) as DD.MM.YYYY */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/** Days elapsed from a start date to today (inclusive) */
export function daysElapsed(start: Date | string | null | undefined): number {
  if (!start) return 0;
  const s = typeof start === "string" ? new Date(start) : start;
  const now = new Date();
  const diffMs = now.getTime() - s.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/** Format mileage as "123 456 km" */
export function formatMileage(km: number | null | undefined): string {
  if (km == null) return "—";
  return `${Math.round(km).toLocaleString("de-DE")} km`;
}

/** Format currency amount */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `${amount.toFixed(2)} ${CURRENCY}`;
}

/** Status → Bulgarian label */
export const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Планирана",
  INTAKE: "Приемане",
  IN_PROGRESS: "В процес",
  QUALITY_CHECK: "Проверка",
  READY: "Готова",
  COMPLETED: "Завършена",
  CANCELLED: "Отменена",
};

export const WORKCARD_STATUS_LABELS: Record<string, string> = {
  PENDING: "Изчаква",
  ASSIGNED: "Възложена",
  IN_PROGRESS: "В процес",
  COMPLETED: "Завършена",
  CANCELLED: "Отменена",
};

/** Status → next status in the flow */
export const NEXT_STATUS: Record<string, string> = {
  SCHEDULED: "INTAKE",
  INTAKE: "IN_PROGRESS",
  IN_PROGRESS: "QUALITY_CHECK",
  QUALITY_CHECK: "READY",
  READY: "COMPLETED",
};

/** Status → next action label (Bulgarian) */
export const NEXT_ACTION_LABELS: Record<string, string> = {
  SCHEDULED: "Прием",
  INTAKE: "Към работа",
  IN_PROGRESS: "Проверка",
  QUALITY_CHECK: "Готова",
  READY: "Завърши",
};
