"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_MILEAGE_TRIGGER_KM } from "@/lib/constants";

export function NewTruckForm() {
  const router = useRouter();
  const [plateNumber, setPlateNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [currentMileage, setCurrentMileage] = useState("");
  const [mileageTriggerKm, setMileageTriggerKm] = useState(String(DEFAULT_MILEAGE_TRIGGER_KM));
  const [isAdr, setIsAdr] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/trucks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plateNumber: plateNumber.trim().toUpperCase(),
        make: make.trim(),
        model: model.trim(),
        year: year ? parseInt(year) : null,
        currentMileage: currentMileage ? parseFloat(currentMileage) : null,
        mileageTriggerKm: parseFloat(mileageTriggerKm),
        isAdr,
      }),
    });

    if (res.ok) {
      const created = await res.json();
      router.push(`/trucks/${created.id}`);
    } else {
      const body = await res.json();
      setError(body.error ?? "Грешка при добавяне");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="plate">Регистрационен номер *</Label>
        <Input
          id="plate"
          value={plateNumber}
          onChange={(e) => setPlateNumber(e.target.value)}
          placeholder="TX 1234 AB"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="make">Марка *</Label>
          <Input
            id="make"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            placeholder="Volvo"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="model">Модел *</Label>
          <Input
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="FH16"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="year">Година</Label>
          <Input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2020"
            min={1950}
            max={2100}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mileage">Текущ км</Label>
          <Input
            id="mileage"
            type="number"
            value={currentMileage}
            onChange={(e) => setCurrentMileage(e.target.value)}
            placeholder="500000"
            min={0}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="trigger">Лимит за предупреждение (км)</Label>
        <Input
          id="trigger"
          type="number"
          value={mileageTriggerKm}
          onChange={(e) => setMileageTriggerKm(e.target.value)}
          min={1000}
          required
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isAdr}
          onChange={(e) => setIsAdr(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        <span className="text-sm text-[var(--text-primary)]">ADR камион</span>
      </label>

      {error && <p className="text-sm text-[var(--status-cancelled)]">{error}</p>}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Запазване..." : "Добави камион"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/trucks")}>
          Откажи
        </Button>
      </div>
    </form>
  );
}
