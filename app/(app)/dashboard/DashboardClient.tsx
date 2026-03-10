"use client";

import useSWR from "swr";
import Link from "next/link";
import { StatusDot } from "@/components/StatusDot";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { formatDate, formatMileage, daysElapsed } from "@/lib/utils/format";
import { POLLING_INTERVAL } from "@/lib/constants";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Alert {
  truckId: number;
  plateNumber: string;
  currentMileage: number;
  lastServiceMileage: number | null;
  kmSinceService: number;
  mileageTriggerKm: number;
}

interface ActiveService {
  id: number;
  status: string;
  startDate: string | null;
  bayNameSnapshot: string | null;
  truck: { plateNumber: string; make: string; model: string };
  driverNameSnapshot: string | null;
}

interface UpcomingService {
  id: number;
  scheduledDate: string;
  truck: { plateNumber: string; make: string; model: string };
  driverNameSnapshot: string | null;
}

interface DashboardData {
  activeServices: ActiveService[];
  upcomingServices: UpcomingService[];
  alerts: Alert[];
}

export function DashboardClient() {
  const { data, isLoading } = useSWR<DashboardData>("/api/dashboard", fetcher, {
    refreshInterval: POLLING_INTERVAL,
  });

  if (isLoading) return <DashboardSkeleton />;

  const { activeServices = [], upcomingServices = [], alerts = [] } = data ?? {};

  return (
    <div className="space-y-6">
      {/* Alerts band */}
      {alerts.length > 0 && (
        <section>
          <div className="space-y-1">
            {alerts.map((alert) => (
              <div key={alert.truckId}>
                <Link
                  href={`/trucks/${alert.truckId}`}
                  className="flex items-center gap-3 px-3 py-2 rounded bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--status-cancelled)] shrink-0" />
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {alert.plateNumber}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">
                    {formatMileage(alert.kmSinceService)} от последното обслужване (лимит{" "}
                    {formatMileage(alert.mileageTriggerKm)})
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active services */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)] mb-2">
          Активни обслужвания
        </h2>
        {activeServices.length === 0 ? (
          <EmptyState message="Няма активни обслужвания" />
        ) : (
          <div className="rounded border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">
                    Камион
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">
                    Статус
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">
                    Бокс
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">
                    Дни
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">
                    Шофьор
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {activeServices.map((svc) => (
                  <tr
                    key={svc.id}
                    className="h-10 hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                    onClick={() => (window.location.href = `/services/${svc.id}`)}
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/services/${svc.id}`}
                        className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {svc.truck.plateNumber}
                      </Link>
                      <span className="text-[var(--text-muted)] ml-1.5 text-xs">
                        {svc.truck.make} {svc.truck.model}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusDot status={svc.status as Parameters<typeof StatusDot>[0]["status"]} />
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {svc.bayNameSnapshot ?? "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-[var(--text-secondary)]">
                      {svc.startDate ? daysElapsed(svc.startDate) : "—"}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {svc.driverNameSnapshot ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Upcoming queue */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)] mb-2">
          Предстоящи
        </h2>
        {upcomingServices.length === 0 ? (
          <EmptyState message="Няма насрочени обслужвания" />
        ) : (
          <div className="rounded border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">
                    Камион
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">
                    Дата
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">
                    Шофьор
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {upcomingServices.map((svc) => (
                  <tr
                    key={svc.id}
                    className="h-10 hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                    onClick={() => (window.location.href = `/services/${svc.id}`)}
                  >
                    <td className="px-3 py-2">
                      <span className="font-medium text-[var(--text-primary)]">
                        {svc.truck.plateNumber}
                      </span>
                      <span className="text-[var(--text-muted)] ml-1.5 text-xs">
                        {svc.truck.make} {svc.truck.model}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-[var(--text-secondary)]">
                      {formatDate(svc.scheduledDate)}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {svc.driverNameSnapshot ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-40 w-full" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
