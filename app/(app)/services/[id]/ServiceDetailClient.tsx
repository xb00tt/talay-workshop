"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusDot } from "@/components/StatusDot";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDate, formatMileage, daysElapsed, STATUS_LABELS, NEXT_ACTION_LABELS, NEXT_STATUS } from "@/lib/utils/format";
import { POLLING_INTERVAL } from "@/lib/constants";
import { CancelDialog } from "./CancelDialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ServiceDetail {
  id: number;
  status: string;
  scheduledDate: string;
  startDate: string | null;
  endDate: string | null;
  bayNameSnapshot: string | null;
  mileageAtService: number | null;
  driverNameSnapshot: string | null;
  cancellationReason: string | null;
  truck: {
    id: number;
    plateNumber: string;
    make: string;
    model: string;
    year: number | null;
    isAdr: boolean;
    currentMileage: number | null;
  };
  sections: Array<{
    id: number;
    type: string;
    title: string;
    order: number;
    checklistItems?: Array<{ id: number; description: string; isCompleted: boolean }>;
    workCards?: Array<{ id: number; status: string; mechanicName: string; description: string }>;
  }>;
  notes: Array<{ id: number; content: string; userNameSnapshot: string; createdAt: string }>;
}

export function ServiceDetailClient({ serviceId }: { serviceId: number }) {
  const router = useRouter();
  const { data: service, isLoading, mutate } = useSWR<ServiceDetail>(
    `/api/services/${serviceId}`,
    fetcher,
    { refreshInterval: POLLING_INTERVAL }
  );

  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState("");
  const [advanceWarning, setAdvanceWarning] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  if (isLoading) return <DetailSkeleton />;
  if (!service) return <p className="text-[var(--text-secondary)]">Обслужването не е намерено.</p>;

  const nextStatus = NEXT_STATUS[service.status];
  const nextLabel = NEXT_ACTION_LABELS[service.status];
  const isTerminal = service.status === "COMPLETED" || service.status === "CANCELLED";

  async function handleAdvance(skipWarning = false) {
    setAdvancing(true);
    setAdvanceError("");
    setAdvanceWarning("");

    const res = await fetch(`/api/services/${serviceId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus, skipWarning }),
    });

    const body = await res.json();

    if (res.ok) {
      await mutate();
    } else if (res.status === 409 && body.warning) {
      setAdvanceWarning(body.warning);
    } else {
      setAdvanceError(body.error ?? "Грешка");
    }

    setAdvancing(false);
  }

  return (
    <div className="space-y-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 -mx-6 -mt-6 px-6 pt-4 pb-3 bg-[var(--bg-base)] border-b border-[var(--border)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/services"
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] shrink-0"
            >
              ← Обслужвания
            </Link>
            <span className="text-[var(--border)]">/</span>
            <Link
              href={`/trucks/${service.truck.id}`}
              className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] text-lg"
            >
              {service.truck.plateNumber}
            </Link>
            <span className="text-sm text-[var(--text-secondary)] truncate">
              {service.truck.make} {service.truck.model}
              {service.truck.year ? ` ${service.truck.year}` : ""}
            </span>
            {service.truck.isAdr && (
              <span className="shrink-0 px-1.5 py-0.5 text-xs font-medium border border-[var(--status-quality-check)] text-[var(--status-quality-check)] rounded">
                ADR
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <StatusDot status={service.status as Parameters<typeof StatusDot>[0]["status"]} />
            {!isTerminal && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCancel(true)}
                >
                  Откажи
                </Button>
                {nextLabel && (
                  <Button
                    size="sm"
                    disabled={advancing}
                    onClick={() => handleAdvance()}
                  >
                    {advancing ? "..." : nextLabel}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Advance warning */}
        {advanceWarning && (
          <div className="mt-2 flex items-center gap-3 text-sm text-[var(--status-quality-check)]">
            <span>{advanceWarning}</span>
            <Button size="sm" variant="outline" onClick={() => handleAdvance(true)}>
              Продължи въпреки това
            </Button>
            <button
              onClick={() => setAdvanceWarning("")}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              ✕
            </button>
          </div>
        )}
        {advanceError && (
          <p className="mt-2 text-sm text-[var(--status-cancelled)]">{advanceError}</p>
        )}
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap gap-6 text-sm">
        <MetaItem label="Планирана дата" value={formatDate(service.scheduledDate)} />
        {service.startDate && <MetaItem label="Начало" value={formatDate(service.startDate)} />}
        {service.endDate && <MetaItem label="Край" value={formatDate(service.endDate)} />}
        {service.startDate && !service.endDate && (
          <MetaItem label="Дни в работа" value={String(daysElapsed(service.startDate))} />
        )}
        {service.bayNameSnapshot && <MetaItem label="Бокс" value={service.bayNameSnapshot} />}
        {service.mileageAtService && (
          <MetaItem label="Километраж" value={formatMileage(service.mileageAtService)} />
        )}
        {service.driverNameSnapshot && (
          <MetaItem label="Шофьор" value={service.driverNameSnapshot} />
        )}
        {service.cancellationReason && (
          <MetaItem label="Причина за отказ" value={service.cancellationReason} />
        )}
      </div>

      {/* Sections */}
      {service.sections
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <ServiceSection key={section.id} section={section} serviceId={serviceId} onMutate={mutate} />
        ))}

      {/* Notes */}
      <NotesSection serviceId={serviceId} notes={service.notes} onMutate={mutate} />

      {/* Cancel dialog */}
      {showCancel && (
        <CancelDialog
          serviceId={serviceId}
          onClose={() => setShowCancel(false)}
          onCancelled={() => {
            setShowCancel(false);
            mutate();
          }}
        />
      )}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--text-muted)] uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function ServiceSection({
  section,
  serviceId,
  onMutate,
}: {
  section: ServiceDetail["sections"][0];
  serviceId: number;
  onMutate: () => void;
}) {
  const SECTION_TYPE_LABELS: Record<string, string> = {
    CHECKLIST: "Контролен лист",
    EQUIPMENT_CHECK: "Проверка на оборудване",
    DRIVER_FEEDBACK: "Сигнали от шофьор",
    MID_SERVICE: "Открити по време на обслужване",
    CUSTOM: section.title,
  };

  const label = SECTION_TYPE_LABELS[section.type] ?? section.title;

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </h2>

      {section.type === "CHECKLIST" && section.checklistItems && (
        <ChecklistSection
          serviceId={serviceId}
          sectionId={section.id}
          items={section.checklistItems}
          onMutate={onMutate}
        />
      )}

      {(section.type === "DRIVER_FEEDBACK" ||
        section.type === "MID_SERVICE" ||
        section.type === "CUSTOM") &&
        section.workCards && (
          <WorkCardsTable
            workCards={section.workCards}
            serviceId={serviceId}
          />
        )}

      {section.type === "EQUIPMENT_CHECK" && (
        <p className="text-sm text-[var(--text-secondary)]">
          Проверката на оборудване се управлява при прехода на статус.
        </p>
      )}
    </section>
  );
}

function ChecklistSection({
  serviceId,
  sectionId,
  items,
  onMutate,
}: {
  serviceId: number;
  sectionId: number;
  items: Array<{ id: number; description: string; isCompleted: boolean }>;
  onMutate: () => void;
}) {
  async function toggleItem(itemId: number, isCompleted: boolean) {
    await fetch(`/api/services/${serviceId}/checklist/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted }),
    });
    onMutate();
  }

  const completed = items.filter((i) => i.isCompleted).length;

  return (
    <div className="rounded border border-[var(--border)] overflow-hidden">
      <div className="px-3 py-1.5 bg-[var(--bg-elevated)] border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)]">
          {completed}/{items.length} изпълнени
        </span>
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-3 py-2">
            <input
              type="checkbox"
              checked={item.isCompleted}
              onChange={(e) => toggleItem(item.id, e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <span
              className={`text-sm ${item.isCompleted ? "line-through text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}
            >
              {item.description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WorkCardsTable({
  workCards,
  serviceId,
}: {
  workCards: Array<{ id: number; status: string; mechanicName: string; description: string }>;
  serviceId: number;
}) {
  const WORKCARD_STATUS_LABELS: Record<string, string> = {
    PENDING: "Изчаква",
    ASSIGNED: "Назначена",
    IN_PROGRESS: "В процес",
    COMPLETED: "Завършена",
    CANCELLED: "Отменена",
  };

  if (workCards.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)] py-2">Няма работни карти.</p>
    );
  }

  return (
    <div className="rounded border border-[var(--border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Механик</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Описание</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Статус</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {workCards.map((card) => (
            <tr key={card.id} className="h-10 hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer">
              <td className="px-3 py-2">
                <Link
                  href={`/services/${serviceId}/work-cards/${card.id}`}
                  className="text-[var(--text-primary)] hover:text-[var(--accent)] font-medium"
                >
                  {card.mechanicName}
                </Link>
              </td>
              <td className="px-3 py-2 text-[var(--text-secondary)] max-w-xs truncate">
                {card.description}
              </td>
              <td className="px-3 py-2 text-[var(--text-secondary)]">
                {WORKCARD_STATUS_LABELS[card.status] ?? card.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesSection({
  serviceId,
  notes,
  onMutate,
}: {
  serviceId: number;
  notes: Array<{ id: number; content: string; userNameSnapshot: string; createdAt: string }>;
  onMutate: () => void;
}) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);

    await fetch(`/api/services/${serviceId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    setContent("");
    setSubmitting(false);
    onMutate();
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Бележки</h2>

      {notes.length > 0 && (
        <div className="space-y-1">
          {notes.map((note) => (
            <div key={note.id} className="rounded border border-[var(--border)] px-3 py-2 text-sm">
              <p className="text-[var(--text-primary)]">{note.content}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {note.userNameSnapshot} · {formatDate(note.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addNote} className="flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Добави бележка..."
          className="flex-1 h-8 px-3 text-sm rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
        />
        <Button type="submit" size="sm" disabled={submitting || !content.trim()}>
          Добави
        </Button>
      </form>
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-14 w-full" />
      <div className="flex gap-6">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
