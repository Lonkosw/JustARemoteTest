"use client";

import { useState } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import {
  GOAL_LABELS,
  LEVEL_LABELS,
  type Goal,
  type Level,
  type Profile,
  type Sex,
} from "@/lib/types";

export interface ProfileFormValues {
  name: string;
  sex: Sex | null;
  birth_year: number | null;
  height_cm: number | null;
  goal: Goal | null;
  level: Level | null;
  days_per_week: number | null;
  /** Only asked on onboarding: becomes the first body measurement. */
  weight_kg?: number | null;
}

/** Parse a numeric input. Accepts comma as decimal separator. */
function toNumber(value: string): number | null {
  const n = Number(value.replace(",", "."));
  return value.trim() === "" || Number.isNaN(n) ? null : n;
}

export function ProfileForm({
  initial,
  askWeight = false,
  submitLabel,
  onSubmit,
}: {
  initial?: Profile;
  askWeight?: boolean;
  submitLabel: string;
  onSubmit: (values: ProfileFormValues) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sex, setSex] = useState(initial?.sex ?? "");
  const [birthYear, setBirthYear] = useState(initial?.birth_year?.toString() ?? "");
  const [height, setHeight] = useState(initial?.height_cm?.toString() ?? "");
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState(initial?.goal ?? "");
  const [level, setLevel] = useState(initial?.level ?? "");
  const [days, setDays] = useState(initial?.days_per_week?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const thisYear = new Date().getFullYear();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        sex: (sex || null) as Sex | null,
        birth_year: toNumber(birthYear),
        height_cm: toNumber(height),
        goal: (goal || null) as Goal | null,
        level: (level || null) as Level | null,
        days_per_week: toNumber(days),
        weight_kg: askWeight ? toNumber(weight) : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nome">
        <Input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Sexo">
          <Select value={sex} onChange={(e) => setSex(e.target.value)}>
            <option value="">—</option>
            <option value="m">Masculino</option>
            <option value="f">Feminino</option>
          </Select>
        </Field>
        <Field label="Ano de nascimento">
          <Input
            inputMode="numeric"
            type="number"
            min={1900}
            max={thisYear}
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Altura (cm)">
          <Input
            inputMode="decimal"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="175"
          />
        </Field>
        {askWeight && (
          <Field label="Peso (kg)">
            <Input
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="78,5"
            />
          </Field>
        )}
      </div>

      <Field label="Objetivo">
        <Select value={goal} onChange={(e) => setGoal(e.target.value)}>
          <option value="">—</option>
          {Object.entries(GOAL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nível">
          <Select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">—</option>
            {Object.entries(LEVEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dias por semana">
          <Select value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Button type="submit" disabled={busy || !name.trim()} className="mt-2">
        {busy ? "Salvando…" : submitLabel}
      </Button>
    </form>
  );
}
