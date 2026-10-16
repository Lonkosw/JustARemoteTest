"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ChevronRightIcon, CloseIcon, PlusIcon } from "@/components/icons";
import { LineChart } from "@/components/line-chart";
import { PhotoImage } from "@/components/photo-image";
import { Splash } from "@/components/splash";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { bmi, latestWithChange, listMeasurements, MEASUREMENT_FIELDS, series, today, type MeasurementKey } from "@/lib/body";
import { db } from "@/lib/db";
import { addPhoto, listPhotos, POSE_LABELS, type Pose } from "@/lib/photos";
import { formatKg } from "@/lib/workouts";

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });

export function formatDay(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return shortDate.format(new Date(y, m - 1, d));
}

/** Evolução > Corpo: weight and measurements over time, and progress photos. */
export function BodyTab({ userId }: { userId: string }) {
  const data = useLiveQuery(async () => {
    const [rows, photos, profile] = await Promise.all([
      listMeasurements(userId),
      listPhotos(userId),
      db.profiles.get(userId),
    ]);
    return { rows, photos, height: profile?.height_cm ?? null };
  }, [userId]);
  const [metric, setMetric] = useState<MeasurementKey>("weight_kg");

  if (!data) return <Splash />;
  const { rows, photos, height } = data;

  const weight = latestWithChange(rows, "weight_kg");
  const imc = bmi(weight?.value ?? null, height);
  const available = MEASUREMENT_FIELDS.filter(({ key }) => series(rows, key).length > 0);
  const current = available.find((f) => f.key === metric) ?? available[0];
  const points = current ? series(rows, current.key) : [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted">Peso atual</p>
            <p className="text-3xl font-bold tabular-nums">{weight ? `${formatKg(weight.value)} kg` : "—"}</p>
            {weight?.change !== null && weight?.change !== undefined && (
              <p className="text-sm text-muted tabular-nums">
                {weight.change > 0 ? "+" : weight.change < 0 ? "−" : "±"}
                {formatKg(Math.abs(weight.change))} kg em 30 dias
              </p>
            )}
          </div>
          {imc !== null && (
            <div className="text-right">
              <p className="text-xs text-muted">IMC</p>
              <p className="text-lg font-semibold tabular-nums">{formatKg(imc)}</p>
            </div>
          )}
        </div>
        <Link
          href="/corpo/medidas"
          className="mt-4 flex h-11 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground"
        >
          Registrar peso e medidas
        </Link>
      </Card>

      {current && (
        <Card>
          {available.length > 1 && (
            <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
              {available.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setMetric(f.key)}
                  aria-pressed={current.key === f.key}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    current.key === f.key ? "bg-accent text-accent-foreground" : "bg-surface-2 text-muted"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <h2 className="mb-1 text-sm font-semibold">
            {current.label} ({current.unit})
          </h2>
          {points.length >= 2 ? (
            <LineChart
              points={points.map((p) => ({ date: `${p.date}T12:00:00`, value: p.value }))}
              unit={current.unit}
              label={current.label}
            />
          ) : (
            <p className="py-6 text-center text-sm text-muted">O gráfico aparece a partir do segundo registro.</p>
          )}
        </Card>
      )}

      <PhotoSection userId={userId} photos={photos} />

      {rows.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Registros</h2>
          <ul className="flex flex-col gap-2">
            {[...rows].reverse().map((r) => (
              <li key={r.id}>
                <Link href={`/corpo/medidas?id=${r.id}`} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{formatDay(r.measured_on)}</p>
                    <p className="truncate text-sm text-muted tabular-nums">
                      {MEASUREMENT_FIELDS.filter((f) => r[f.key] !== null)
                        .map((f) => `${f.key === "weight_kg" ? "" : `${f.label} `}${formatKg(r[f.key])} ${f.unit}`)
                        .join(" · ")}
                    </p>
                  </div>
                  <ChevronRightIcon />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PhotoSection({ userId, photos }: { userId: string; photos: Awaited<ReturnType<typeof listPhotos>> }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [comparing, setComparing] = useState<string[] | null>(null);

  function pick(id: string) {
    if (!comparing) return router.push(`/corpo/foto?id=${id}`);
    const next = comparing.includes(id) ? comparing.filter((x) => x !== id) : [...comparing, id];
    if (next.length === 2) {
      // Older photo on the left.
      const [a, b] = next.map((x) => photos.find((p) => p.id === x)!).sort((p, q) => p.taken_on.localeCompare(q.taken_on));
      router.push(`/corpo/comparar?a=${a.id}&b=${b.id}`);
    } else setComparing(next);
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Fotos de progresso</h2>
        <div className="flex gap-2">
          {photos.length >= 2 && (
            <button
              onClick={() => setComparing(comparing ? null : [])}
              className="rounded-full bg-surface-2 px-3 py-1.5 text-sm font-semibold"
            >
              {comparing ? "Cancelar" : "Comparar"}
            </button>
          )}
          <button
            onClick={() => input.current?.click()}
            className="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-semibold text-accent"
          >
            <PlusIcon /> Foto
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Escolher foto"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) setPending(file);
          }}
        />
      </div>

      {comparing && <p className="mb-3 text-sm text-accent">Toque em duas fotos para comparar.</p>}

      {photos.length === 0 ? (
        <Card className="text-center text-sm text-muted">
          Tire fotos na mesma pose e luz a cada poucas semanas para ver a mudança. Elas ficam privadas.
        </Card>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((photo) => {
            const selected = comparing?.includes(photo.id);
            return (
              <li key={photo.id}>
                <button
                  onClick={() => pick(photo.id)}
                  aria-pressed={comparing ? selected : undefined}
                  aria-label={`Foto ${POSE_LABELS[photo.pose ?? "other"]} de ${formatDay(photo.taken_on)}`}
                  className={`relative block w-full overflow-hidden rounded-xl ${selected ? "ring-2 ring-accent" : ""}`}
                >
                  <PhotoImage photo={photo} size="thumb" alt="" className="aspect-[3/4] w-full" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1 text-left text-[11px] leading-tight">
                    {formatDay(photo.taken_on)}
                    <br />
                    <span className="text-muted">{POSE_LABELS[photo.pose ?? "other"]}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pending && (
        <NewPhotoSheet
          file={pending}
          onClose={() => setPending(null)}
          onSave={async (values) => {
            await addPhoto(userId, pending, values);
            setPending(null);
          }}
        />
      )}
    </section>
  );
}

function NewPhotoSheet({
  file,
  onClose,
  onSave,
}: {
  file: File;
  onClose: () => void;
  onSave: (values: { taken_on: string; pose: Pose }) => Promise<void>;
}) {
  const [takenOn, setTakenOn] = useState(today);
  const [pose, setPose] = useState<Pose>("front");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [preview] = useState(() => URL.createObjectURL(file));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave({ taken_on: takenOn, pose });
      URL.revokeObjectURL(preview);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60" role="dialog" aria-label="Nova foto">
      <form
        onSubmit={save}
        className="flex max-h-[90dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Nova foto</h3>
          <button type="button" aria-label="Cancelar" onClick={onClose} className="p-1">
            <CloseIcon />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Pré-visualização" className="mx-auto max-h-64 rounded-xl object-contain" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <Input type="date" required max={today()} value={takenOn} onChange={(e) => setTakenOn(e.target.value)} />
          </Field>
          <Field label="Pose">
            <Select value={pose} onChange={(e) => setPose(e.target.value as Pose)}>
              {(Object.keys(POSE_LABELS) as Pose[]).map((p) => (
                <option key={p} value={p}>
                  {POSE_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {error && <p className="text-sm text-danger">Não foi possível ler esta imagem. Tente outra.</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "Salvando…" : "Salvar foto"}
        </Button>
      </form>
    </div>
  );
}
