"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMileage } from "@/lib/utils/format";
import { POLLING_INTERVAL } from "@/lib/constants";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Truck {
  id: number;
  plateNumber: string;
  make: string;
  model: string;
  year: number | null;
  currentMileage: number | null;
  mileageTriggerKm: number;
  isAdr: boolean;
  isActive: boolean;
}

interface TrucksData {
  trucks: Truck[];
  total: number;
  page: number;
  pageSize: number;
}

export function TrucksClient() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [includeInactive, setIncludeInactive] = useState(false);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: "10",
    ...(search ? { search } : {}),
    ...(includeInactive ? { includeInactive: "true" } : {}),
  });

  const { data, isLoading } = useSWR<TrucksData>(`/api/trucks?${params}`, fetcher, {
    refreshInterval: POLLING_INTERVAL,
  });

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const { trucks = [], total = 0, pageSize = 10 } = data ?? {};
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Търси камион..."
          value={search}
          onChange={handleSearch}
          className="w-48"
        />
        <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => { setIncludeInactive(e.target.checked); setPage(1); }}
            className="accent-[var(--accent)]"
          />
          Включи неактивни
        </label>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : trucks.length === 0 ? (
        <EmptyState
          message="Няма намерени камиони"
          actionLabel="Добави камион"
          onAction={() => router.push("/trucks/new")}
        />
      ) : (
        <div className="rounded border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Номер</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Марка / Модел</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Километраж</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">ADR</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {trucks.map((truck) => (
                  <tr
                    key={truck.id}
                    className="h-10 hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                    onClick={() => router.push(`/trucks/${truck.id}`)}
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/trucks/${truck.id}`}
                        className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {truck.plateNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {truck.make} {truck.model}
                      {truck.year ? <span className="text-[var(--text-muted)] ml-1">{truck.year}</span> : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-[var(--text-secondary)]">
                      {formatMileage(truck.currentMileage)}
                    </td>
                    <td className="px-3 py-2">
                      {truck.isAdr && (
                        <span className="px-1.5 py-0.5 text-xs font-medium border border-[var(--status-quality-check)] text-[var(--status-quality-check)] rounded">
                          ADR
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {truck.isActive ? (
                        <span className="text-[var(--text-muted)] text-xs">Активен</span>
                      ) : (
                        <span className="text-[var(--status-cancelled)] text-xs">Неактивен</span>
                      )}
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">{total} камиона</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Назад</Button>
            <span className="text-xs text-[var(--text-secondary)] tabular-nums">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Напред</Button>
          </div>
        </div>
      )}
    </div>
  );
}
