"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useSignedIn } from "@/components/auth-provider";
import { BackIcon, TrashIcon } from "@/components/icons";
import { Splash } from "@/components/splash";
import { Button, Card, Field, Input } from "@/components/ui";
import {
  deleteMeasurement,
  hasAnyValue,
  MEASUREMENT_FIELDS,
  saveMeasurement,
  today,
  type MeasurementKey,
} from "@/lib/body";
import { db } from "@/lib/db";
import type { BodyMeasurement } from "@/lib/types";

const BACK = "/evolucao?aba=corpo";

export default function MeasurementPage() {
  return (
    <Suspense fallback={<Splash />}>
      <Measurement />
    </Suspense>
  );
}

function Measurement() {
  const id = useSearchParams().get("id");
  const { userId } = useSignedIn();
  // null: new entry; undefined: loading.
  const existing = useLiveQuery(async () => (id ? ((await db.body_measurements.get(id)) ?? null) : null), [id]);

  if (existing === undefined) return <Splash />;
  if (id && (!existing || existing.deleted_at || existing.user_id !== userId)) {
    return <Card className="text-center text-muted">Registro não encontrado.</Card>;
  }
  return <MeasurementForm key={id ?? "new"} userId={userId} existing={existing ?? undefined} />;
}

/** "78,5" or "78.5" to a number; empty to null. */
function parse(value: string): number | null {
  const n = Number(value.replace(",", ".").trim());
  return value.trim() === "" || Number.isNaN(n) || n <= 0 ? null : n;
}

function MeasurementForm({ userId, existing }: { userId: string; existing?: BodyMeasurement }) {
  const router = useRouter();
  const [date, setDate] = useState(existing?.measured_on ?? today());
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [values, setValues] = useState<Record<MeasurementKey, string>>(
    () =>
      Object.fromEntries(
        MEASUREMENT_FIELDS.map(({ key }) => [key, existing?.[key]?.toString().replace(".", ",") ?? ""]),
      ) as Record<MeasurementKey, string>,
  );
  const [busy, setBusy] = useState(false);

  const parsed = Object.fromEntries(MEASUREMENT_FIELDS.map(({ key }) => [key, parse(values[key])])) as Record<
    MeasurementKey,
    number | null
  >;
  const invalid = (parsed.body_fat_pct ?? 0) >= 100;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    await saveMeasurement(userId, { ...parsed, measured_on: date, notes: notes.trim() || null }, existing?.id);
    router.replace(BACK);
  }

  async function remove() {
    if (!existing || !confirm("Excluir este registro?")) return;
    await deleteMeasurement(existing.id);
    router.replace(BACK);
  }

  return (
    <>
      <header className="mb-5 flex items-center gap-2">
        <button aria-label="Voltar" onClick={() => router.back()} className="-ml-2 p-2">
          <BackIcon />
        </button>
        <h1 className="text-2xl font-bold">{existing ? "Editar registro" : "Peso e medidas"}</h1>
      </header>

      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Data">
          <Input type="date" required max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          {MEASUREMENT_FIELDS.map(({ key, label, unit }) => (
            <Field key={key} label={`${label} (${unit})`}>
              <Input
                inputMode="decimal"
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
        <p className="-mt-1 text-xs text-muted">
          Preencha só o que quiser. Meça sempre no mesmo horário, de preferência em jejum.
        </p>

        <Field label="Observação">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {invalid && <p className="text-sm text-danger">Gordura corporal precisa ser menor que 100%.</p>}
        <Button type="submit" disabled={busy || invalid || !hasAnyValue(parsed)}>
          {busy ? "Salvando…" : "Salvar"}
        </Button>
      </form>

      {existing && (
        <button onClick={remove} className="mx-auto mt-8 flex items-center gap-2 text-sm font-semibold text-danger">
          <TrashIcon /> Excluir registro
        </button>
      )}
    </>
  );
}
