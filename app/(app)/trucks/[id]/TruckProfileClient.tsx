"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/StatusDot";
import { formatDate, formatMileage } from "@/lib/utils/format";
import { POLLING_INTERVAL } from "@/lib/constants";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Tab = "history" | "mileage";

interface TruckDetail {
  id: number;
  plateNumber: string;
  make: string;
  model: string;
  year: number | null;
  currentMileage: number | null;
  mileageTriggerKm: number;
  isAdr: boolean;
  isActive: boolean;
  frotcomVehicleId: string | null;
  useCanbusMileage: boolean;
  services: Array<{
    id: number;
    status: string;
    scheduledDate: string;
    startDate: string | null;
    endDate: string | null;
    bayNameSnapshot: string | null;
    mileageAtService: number | null;
  }>;
}

export function TruckProfileClient({ truckId }: { truckId: number }) {
  const router = useRouter();
  const { data: truck, isLoading, mutate } = useSWR<TruckDetail>(
    `/api/trucks/${truckId}`,
    fetcher,
    { refreshInterval: POLLING_INTERVAL }
  );

  const [tab, setTab] = useState<Tab>("history");
  const [editingMileage, setEditingMileage] = useState(false);
  const [newMileage, setNewMileage] = useState("");
  const [mileageError, setMileageError] = useState("");
  const [savingMileage, setSavingMileage] = useState(false);

  if (isLoading) return <ProfileSkeleton />;
  if (!truck) return <p className="text-[var(--text-secondary)]">Камионът не е намерен.</p>;

  async function saveMileage() {
    const val = parseFloat(newMileage);
    if (isNaN(val) || val < 0) { setMileageError("Невалиден километраж"); return; }
    setSavingMileage(true);
    setMileageError("");

    const res = await fetch(`/api/trucks/${truckId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentMileage: val }),
    });

    if (res.ok) {
      setEditingMileage(false);
      setNewMileage("");
      mutate();
    } else {
      setMileageError("Грешка при запазване");
    }
    setSavingMileage(false);
  }

  async function toggleActive() {
    await fetch(`/api/trucks/${truckId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !truck!.isActive }),
    });
    mutate();
  }

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link href="/trucks" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)]">
        ← Камиони
      </Link>

      <div className="flex gap-6 flex-col md:flex-row">
        {/* Left: identity card */}
        <div className="md:w-56 shrink-0 space-y-4">
          <div className="rounded border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-3">
            <div>
              <div className="text-xl font-semibold text-[var(--text-primary)]">{truck.plateNumber}</div>
              <div className="text-sm text-[var(--text-secondary)]">{truck.make} {truck.model}</div>
              {truck.year && <div className="text-xs text-[var(--text-muted)]">{truck.year}</div>}
            </div>

            <div className="space-y-1.5 text-sm">
              {truck.isAdr && (
                <div className="inline-block px-1.5 py-0.5 text-xs font-medium border border-[var(--status-quality-check)] text-[var(--status-quality-check)] rounded">
                  ADR
                </div>
              )}
              <div>
                <span className="text-[var(--text-muted)] text-xs uppercase tracking-wide">Км</span>
                <div className="tabular-nums text-[var(--text-primary)]">
                  {formatMileage(truck.currentMileage)}
                </div>
              </div>
              <div>
                <span className="text-[var(--text-muted)] text-xs uppercase tracking-wide">Лимит</span>
                <div className="tabular-nums text-[var(--text-secondary)]">
                  {formatMileage(truck.mileageTriggerKm)}
                </div>
              </div>
              {truck.frotcomVehicleId && (
                <div>
                  <span className="text-[var(--text-muted)] text-xs uppercase tracking-wide">Frotcom</span>
                  <div className="text-xs text-[var(--text-secondary)]">{truck.frotcomVehicleId}</div>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <Link href={`/services/new?truckId=${truck.id}`}>
                <Button size="sm" className="w-full">Ново обслужване</Button>
              </Link>
              {!truck.frotcomVehicleId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setEditingMileage(true);
                    setNewMileage(String(truck.currentMileage ?? ""));
                  }}
                >
                  Обнови км
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={toggleActive}
              >
                {truck.isActive ? "Деактивирай" : "Активирай"}
              </Button>
            </div>

            {editingMileage && (
              <div className="pt-2 space-y-2">
                <input
                  type="number"
                  value={newMileage}
                  onChange={(e) => setNewMileage(e.target.value)}
                  className="w-full h-8 px-2 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder="км"
                  min={0}
                />
                {mileageError && <p className="text-xs text-[var(--status-cancelled)]">{mileageError}</p>}
                <div className="flex gap-1">
                  <Button size="sm" onClick={saveMileage} disabled={savingMileage}>Запази</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingMileage(false)}>Откажи</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: tabs */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex gap-1 border-b border-[var(--border)]">
            {(["history", "mileage"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm border-b-2 transition-colors -mb-px ${
                  tab === t
                    ? "border-[var(--accent)] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t === "history" ? "История" : "Километри"}
              </button>
            ))}
          </div>

          {tab === "history" && (
            <ServiceHistory services={truck.services} />
          )}

          {tab === "mileage" && (
            <MileageHistory services={truck.services} currentMileage={truck.currentMileage} />
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceHistory({ services }: { services: TruckDetail["services"] }) {
  if (services.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)]">Няма обслужвания.</p>;
  }

  return (
    <div className="rounded border border-[var(--border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Дата</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Статус</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Бокс</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Км</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {services.map((svc) => (
            <tr
              key={svc.id}
              className="h-10 hover:bg-[var(--bg-elevated)] cursor-pointer"
              onClick={() => (window.location.href = `/services/${svc.id}`)}
            >
              <td className="px-3 py-2 tabular-nums text-[var(--text-secondary)]">
                {formatDate(svc.scheduledDate)}
              </td>
              <td className="px-3 py-2">
                <StatusDot status={svc.status as Parameters<typeof StatusDot>[0]["status"]} />
              </td>
              <td className="px-3 py-2 text-[var(--text-secondary)]">
                {svc.bayNameSnapshot ?? "—"}
              </td>
              <td className="px-3 py-2 tabular-nums text-[var(--text-secondary)]">
                {formatMileage(svc.mileageAtService)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MileageHistory({
  services,
  currentMileage,
}: {
  services: TruckDetail["services"];
  currentMileage: number | null;
}) {
  const withMileage = services.filter((s) => s.mileageAtService != null);

  return (
    <div className="space-y-3">
      <div className="text-sm text-[var(--text-secondary)]">
        Текущ километраж:{" "}
        <span className="tabular-nums text-[var(--text-primary)] font-medium">
          {formatMileage(currentMileage)}
        </span>
      </div>

      {withMileage.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">Няма записани километри при обслужвания.</p>
      ) : (
        <div className="rounded border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Дата</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Км при обслужване</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {withMileage.map((svc) => (
                <tr key={svc.id} className="h-10 hover:bg-[var(--bg-elevated)]">
                  <td className="px-3 py-2 tabular-nums text-[var(--text-secondary)]">
                    {formatDate(svc.scheduledDate)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[var(--text-primary)]">
                    {formatMileage(svc.mileageAtService)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex gap-6">
      <Skeleton className="w-56 h-80" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
