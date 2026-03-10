"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatCurrency, WORKCARD_STATUS_LABELS } from "@/lib/utils/format";
import { POLLING_INTERVAL } from "@/lib/constants";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface WorkCardDetail {
  id: number;
  status: string;
  description: string;
  mechanicName: string;
  specialInstructions: string | null;
  cancelledAt: string | null;
  reopenedAt: string | null;
  serviceSection: {
    id: number;
    title: string;
    serviceOrder: {
      id: number;
      status: string;
      truckPlateSnapshot: string;
      truck: { plateNumber: string; make: string; model: string };
    };
  };
  parts: Array<{ id: number; name: string; partNumber: string | null; quantity: number; unitCost: number | null }>;
  notes: Array<{ id: number; content: string; userNameSnapshot: string; createdAt: string }>;
  photos: Array<{ id: number; filePath: string; caption: string | null; createdAt: string }>;
}

const STATUS_FLOW: Record<string, { next: string; label: string } | null> = {
  PENDING: { next: "ASSIGNED", label: "Назначи" },
  ASSIGNED: { next: "IN_PROGRESS", label: "Започни" },
  IN_PROGRESS: { next: "COMPLETED", label: "Завърши" },
  COMPLETED: null,
  CANCELLED: { next: "IN_PROGRESS", label: "Отвори отново" },
};

export function WorkCardClient({ serviceId, cardId }: { serviceId: number; cardId: number }) {
  const { data: card, isLoading, mutate } = useSWR<WorkCardDetail>(
    `/api/services/${serviceId}/work-cards/${cardId}`,
    fetcher,
    { refreshInterval: POLLING_INTERVAL }
  );

  const [statusError, setStatusError] = useState("");
  const [advancing, setAdvancing] = useState(false);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!card) return <p className="text-sm text-[var(--text-secondary)]">Картата не е намерена.</p>;

  const service = card.serviceSection.serviceOrder;
  const nextAction = STATUS_FLOW[card.status];

  async function changeStatus(newStatus: string) {
    setAdvancing(true);
    setStatusError("");
    const res = await fetch(`/api/services/${serviceId}/work-cards/${cardId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const body = await res.json();
      setStatusError(body.error ?? "Грешка");
    } else {
      await mutate();
    }
    setAdvancing(false);
  }

  async function cancelCard() {
    if (!confirm("Откажи работната карта?")) return;
    await changeStatus("CANCELLED");
  }

  const totalCost = card.parts.reduce((sum, p) => sum + (p.unitCost ?? 0) * p.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 -mx-6 -mt-6 px-6 pt-4 pb-3 bg-[var(--bg-base)] border-b border-[var(--border)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Link href="/services" className="text-[var(--text-secondary)] hover:text-[var(--accent)] shrink-0">
              Обслужвания
            </Link>
            <span className="text-[var(--border)]">/</span>
            <Link href={`/services/${serviceId}`} className="text-[var(--text-secondary)] hover:text-[var(--accent)] shrink-0">
              {service.truckPlateSnapshot}
            </Link>
            <span className="text-[var(--border)]">/</span>
            <span className="text-[var(--text-primary)] truncate">{card.mechanicName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-[var(--text-muted)]">
              {WORKCARD_STATUS_LABELS[card.status] ?? card.status}
            </span>
            {card.status !== "COMPLETED" && card.status !== "CANCELLED" && (
              <Button size="sm" variant="outline" onClick={cancelCard}>
                Откажи карта
              </Button>
            )}
            {nextAction && (
              <Button size="sm" disabled={advancing} onClick={() => changeStatus(nextAction.next)}>
                {advancing ? "..." : nextAction.label}
              </Button>
            )}
          </div>
        </div>
        {statusError && <p className="mt-1 text-xs text-[var(--status-cancelled)]">{statusError}</p>}
      </div>

      {/* Description */}
      <section className="space-y-2">
        <h2 className="section-heading">Описание</h2>
        <p className="text-sm text-[var(--text-primary)]">{card.description}</p>
        {card.specialInstructions && (
          <div className="mt-2 p-3 rounded border border-[var(--border)] bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)]">
            <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Специални инструкции · </span>
            {card.specialInstructions}
          </div>
        )}
      </section>

      {/* Parts */}
      <PartsSection serviceId={serviceId} cardId={cardId} parts={card.parts} onMutate={mutate} />

      {/* Notes */}
      <NotesSection serviceId={serviceId} cardId={cardId} notes={card.notes} onMutate={mutate} />

      {/* Photos */}
      <PhotosSection serviceId={serviceId} cardId={cardId} photos={card.photos} onMutate={mutate} />
    </div>
  );
}

function PartsSection({
  serviceId, cardId, parts, onMutate
}: {
  serviceId: number;
  cardId: number;
  parts: WorkCardDetail["parts"];
  onMutate: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = parts.reduce((sum, p) => sum + (p.unitCost ?? 0) * p.quantity, 0);

  async function addPart(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");

    const res = await fetch(`/api/services/${serviceId}/work-cards/${cardId}/parts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        partNumber: partNumber.trim() || null,
        quantity: parseFloat(quantity),
        unitCost: unitCost ? parseFloat(unitCost) : null,
      }),
    });

    if (res.ok) {
      setName(""); setPartNumber(""); setQuantity("1"); setUnitCost("");
      setAdding(false);
      onMutate();
    } else {
      const body = await res.json();
      setError(body.error ?? "Грешка");
    }
    setSaving(false);
  }

  async function deletePart(partId: number) {
    await fetch(`/api/services/${serviceId}/work-cards/${cardId}/parts/${partId}`, { method: "DELETE" });
    onMutate();
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="section-heading">Части</h2>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>+ Добави</Button>
        )}
      </div>

      {parts.length > 0 && (
        <div className="rounded border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Наименование</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">№</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Кол.</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Ед. цена</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Сума</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {parts.map((p) => (
                <tr key={p.id} className="h-10">
                  <td className="px-3 py-2 text-[var(--text-primary)]">{p.name}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)] text-xs">{p.partNumber ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{p.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{formatCurrency(p.unitCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-primary)]">
                    {p.unitCost != null ? formatCurrency(p.unitCost * p.quantity) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => deletePart(p.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--status-cancelled)] text-xs"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {total > 0 && (
                <tr className="bg-[var(--bg-elevated)]">
                  <td colSpan={4} className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Общо</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-[var(--text-primary)]">{formatCurrency(total)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <form onSubmit={addPart} className="rounded border border-[var(--border)] p-3 space-y-3 bg-[var(--bg-surface)]">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Наименование *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Маслен филтър" required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Каталожен №</Label>
              <Input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="OC 123" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Количество *</Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min={0.01} step={0.01} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ед. цена (€)</Label>
              <Input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} min={0} step={0.01} placeholder="0.00" />
            </div>
          </div>
          {error && <p className="text-xs text-[var(--status-cancelled)]">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>Добави</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>Откажи</Button>
          </div>
        </form>
      )}
    </section>
  );
}

function NotesSection({
  serviceId, cardId, notes, onMutate
}: {
  serviceId: number;
  cardId: number;
  notes: WorkCardDetail["notes"];
  onMutate: () => void;
}) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    await fetch(`/api/services/${serviceId}/work-cards/${cardId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setContent("");
    setSaving(false);
    onMutate();
  }

  return (
    <section className="space-y-2">
      <h2 className="section-heading">Бележки</h2>
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
        <Button type="submit" size="sm" disabled={saving || !content.trim()}>Добави</Button>
      </form>
    </section>
  );
}

function PhotosSection({
  serviceId, cardId, photos, onMutate
}: {
  serviceId: number;
  cardId: number;
  photos: WorkCardDetail["photos"];
  onMutate: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`/api/services/${serviceId}/work-cards/${cardId}/photos`, {
        method: "POST",
        body: fd,
      });
    }

    setUploading(false);
    onMutate();
    if (fileRef.current) fileRef.current.value = "";
  }

  async function deletePhoto(photoId: number) {
    await fetch(`/api/services/${serviceId}/work-cards/${cardId}/photos/${photoId}`, { method: "DELETE" });
    onMutate();
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="section-heading">Снимки</h2>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? "Качване..." : "+ Снимки"}
        </Button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={upload} />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square rounded border border-[var(--border)] overflow-hidden bg-[var(--bg-elevated)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/uploads/${photo.filePath}`}
                alt={photo.caption ?? ""}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setLightbox(`/uploads/${photo.filePath}`)}
              />
              <button
                onClick={() => deletePhoto(photo.id)}
                className="absolute top-1 right-1 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white text-2xl leading-none"
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}
