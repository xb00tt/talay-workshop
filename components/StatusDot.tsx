"use client";

import { cn } from "@/lib/utils";

type Status =
  | "SCHEDULED"
  | "INTAKE"
  | "IN_PROGRESS"
  | "QUALITY_CHECK"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

const STATUS_STYLES: Record<Status, string> = {
  SCHEDULED: "bg-[var(--status-scheduled)]",
  INTAKE: "bg-[var(--status-intake)]",
  IN_PROGRESS: "bg-[var(--status-in-progress)]",
  QUALITY_CHECK: "bg-[var(--status-quality-check)]",
  READY: "bg-[var(--status-ready)]",
  COMPLETED: "bg-[var(--status-completed)]",
  CANCELLED: "bg-[var(--status-cancelled)]",
};

const STATUS_LABELS: Record<Status, string> = {
  SCHEDULED: "Насрочена",
  INTAKE: "Приемане",
  IN_PROGRESS: "В работа",
  QUALITY_CHECK: "Контрол",
  READY: "Готова",
  COMPLETED: "Завършена",
  CANCELLED: "Отменена",
};

interface StatusDotProps {
  status: Status;
  showLabel?: boolean;
  className?: string;
}

export function StatusDot({ status, showLabel = true, className }: StatusDotProps) {
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <span
        className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", STATUS_STYLES[status])}
      />
      {showLabel && (
        <span className="text-[var(--text-secondary)] text-sm">{STATUS_LABELS[status]}</span>
      )}
    </span>
  );
}
