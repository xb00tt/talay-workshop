"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Truck {
  id: number;
  plateNumber: string;
  make: string;
  model: string;
}

interface Driver {
  id: number;
  name: string;
}

export function NewServiceForm() {
  const router = useRouter();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [truckId, setTruckId] = useState("");
  const [scheduledDate, setScheduledDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [driverId, setDriverId] = useState("none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/trucks?pageSize=200&includeInactive=false")
      .then((r) => r.json())
      .then((d) => setTrucks(d.trucks ?? []));
    fetch("/api/drivers?pageSize=200")
      .then((r) => r.json())
      .then((d) => setDrivers(d.drivers ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!truckId) { setError("Изберете камион"); return; }

    setSubmitting(true);
    setError("");

    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        truckId: parseInt(truckId),
        scheduledDate,
        driverId: driverId !== "none" ? parseInt(driverId) : null,
      }),
    });

    if (res.ok) {
      const created = await res.json();
      router.push(`/services/${created.id}`);
    } else {
      const body = await res.json();
      setError(body.error ?? "Грешка при създаване");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="truck">Камион *</Label>
        <Select value={truckId} onValueChange={(v) => setTruckId(v ?? "")}>
          <SelectTrigger id="truck">
            <SelectValue placeholder="Изберете камион..." />
          </SelectTrigger>
          <SelectContent>
            {trucks.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.plateNumber} — {t.make} {t.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="date">Дата *</Label>
        <Input
          id="date"
          type="date"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="driver">Шофьор</Label>
        <Select value={driverId} onValueChange={(v) => setDriverId(v ?? "none")}>
          <SelectTrigger id="driver">
            <SelectValue placeholder="Без шофьор" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Без шофьор</SelectItem>
            {drivers.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-[var(--status-cancelled)]">{error}</p>}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Запазване..." : "Създай обслужване"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/services")}
        >
          Откажи
        </Button>
      </div>
    </form>
  );
}
