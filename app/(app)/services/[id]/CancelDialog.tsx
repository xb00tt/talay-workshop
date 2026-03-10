"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function CancelDialog({
  serviceId,
  onClose,
  onCancelled,
}: {
  serviceId: number;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError("Въведете причина за отказ"); return; }

    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/services/${serviceId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancellationReason: reason }),
    });

    if (res.ok) {
      onCancelled();
    } else {
      const body = await res.json();
      setError(body.error ?? "Грешка");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Отказване на обслужване</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reason">Причина *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Въведете причина за отказване..."
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-[var(--status-cancelled)]">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Назад
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Запазване..." : "Откажи обслужването"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
