"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusDot } from "@/components/StatusDot";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, daysElapsed } from "@/lib/utils/format";
import { POLLING_INTERVAL } from "@/lib/constants";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ServiceOrder {
  id: number;
  status: string;
  scheduledDate: string;
  startDate: string | null;
  bayNameSnapshot: string | null;
  driverNameSnapshot: string | null;
  truck: { plateNumber: string; make: string; model: string };
}

interface ServicesData {
  services: ServiceOrder[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_FILTER_OPTIONS = [
  { label: "Всички", value: "" },
  { label: "Насрочени", value: "SCHEDULED" },
  { label: "Приемане", value: "INTAKE" },
  { label: "В работа", value: "IN_PROGRESS" },
  { label: "Контрол", value: "QUALITY_CHECK" },
  { label: "Готови", value: "READY" },
  { label: "Завършени", value: "COMPLETED" },
  { label: "Отменени", value: "CANCELLED" },
];

export function ServicesClient() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: "10" });
  if (search) params.set("search", search);
  if (status) params.set("status", status);

  const { data, isLoading } = useSWR<ServicesData>(`/api/services?${params}`, fetcher, {
    refreshInterval: POLLING_INTERVAL,
  });

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const { services = [], total = 0, pageSize = 10 } = data ?? {};
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Търси камион..."
          value={search}
          onChange={handleSearch}
          className="w-48"
        />
        <div className="flex items-center gap-1">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatus(opt.value); setPage(1); }}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                status === opt.value
                  ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : services.length === 0 ? (
        <EmptyState
          message="Няма намерени обслужвания"
          actionLabel="Ново обслужване"
          onAction={() => router.push("/services/new")}
        />
      ) : (
        <div className="rounded border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">Камион</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">Статус</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">Дата</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">Бокс</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">Дни</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)] text-xs uppercase tracking-wide">Шофьор</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {services.map((svc) => (
                <tr
                  key={svc.id}
                  className="h-10 hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                  onClick={() => router.push(`/services/${svc.id}`)}
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
                  <td className="px-3 py-2 tabular-nums text-[var(--text-secondary)]">
                    {formatDate(svc.scheduledDate)}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">
            {total} резултата
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Назад
            </Button>
            <span className="text-xs text-[var(--text-secondary)] tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Напред
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
