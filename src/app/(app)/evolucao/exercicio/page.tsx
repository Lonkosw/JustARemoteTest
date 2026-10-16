"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useSignedIn } from "@/components/auth-provider";
import { BackIcon } from "@/components/icons";
import { LineChart, type ChartPoint } from "@/components/line-chart";
import { Splash } from "@/components/splash";
import { Card } from "@/components/ui";
import { EQUIPMENT, MUSCLE_GROUPS } from "@/lib/exercises";
import { loadLoggedSets, recordsOf, sessionsOf, type Session } from "@/lib/stats";
import { useExercises } from "@/lib/use-exercises";
import { formatKg } from "@/lib/workouts";

export default function ExerciseProgressPage() {
  return (
    <Suspense fallback={<Splash />}>
      <ExerciseProgress />
    </Suspense>
  );
}

type Metric = "e1rm" | "weight" | "volume" | "reps";

const METRICS: Record<Metric, { label: string; unit: string; value: (s: Session) => number | null }> = {
  e1rm: { label: "1RM estimado", unit: "kg", value: (s) => s.bestE1rm },
  weight: { label: "Maior carga", unit: "kg", value: (s) => s.maxWeight },
  volume: { label: "Volume", unit: "kg", value: (s) => s.volume || null },
  reps: { label: "Repetições", unit: "reps", value: (s) => s.maxReps },
};

const dayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

function ExerciseProgress() {
  const id = useSearchParams().get("id") ?? "";
  const { userId } = useSignedIn();
  const router = useRouter();
  const { byId, loading } = useExercises(userId);
  const sets = useLiveQuery(() => loadLoggedSets(userId, { exerciseId: id }), [userId, id]);
  const [metric, setMetric] = useState<Metric | null>(null);

  if (!sets || loading) return <Splash />;
  const exercise = byId.get(id);
  const sessions = sessionsOf(sets);
  const records = recordsOf(sets);
  const loaded = records.weight !== null;

  // Bodyweight exercises chart reps; loaded ones default to estimated 1RM.
  const available: Metric[] = loaded ? ["e1rm", "weight", "volume"] : ["reps"];
  const current = metric && available.includes(metric) ? metric : available[0];
  const points: ChartPoint[] = sessions.flatMap((s) => {
    const value = METRICS[current].value(s);
    if (value === null) return [];
    const best = [...s.sets].sort((a, b) => (b.weight_kg ?? 0) - (a.weight_kg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
    return [
      {
        date: s.date,
        value: Math.round(value * 10) / 10,
        detail: best.weight_kg ? `Melhor: ${formatKg(best.weight_kg)} kg × ${best.reps}` : `Melhor: ${best.reps} reps`,
      },
    ];
  });

  return (
    <>
      <header className="mb-5 flex items-start gap-2">
        <button aria-label="Voltar" onClick={() => router.back()} className="-ml-2 p-2">
          <BackIcon />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{exercise?.name ?? "Exercício"}</h1>
          {exercise && (
            <p className="text-sm text-muted">
              {MUSCLE_GROUPS[exercise.muscle_group]}
              {exercise.equipment && ` · ${EQUIPMENT[exercise.equipment]}`}
            </p>
          )}
        </div>
      </header>

      {sessions.length === 0 ? (
        <Card className="text-center text-muted">
          Nenhum treino finalizado com este exercício ainda.{" "}
          <Link href="/evolucao" className="font-semibold text-accent">
            Voltar
          </Link>
        </Card>
      ) : (
        <>
          <section aria-label="Recordes" className="mb-4 grid grid-cols-3 gap-3">
            {loaded ? (
              <>
                <RecordTile label="1RM estimado" value={records.e1rm === null ? null : `${formatKg(Math.round(records.e1rm * 10) / 10)} kg`} />
                <RecordTile label="Maior carga" value={`${formatKg(records.weight)} kg`} />
              </>
            ) : (
              <RecordTile label="Mais repetições" value={records.reps === null ? null : String(records.reps)} />
            )}
            <RecordTile label="Sessões" value={String(sessions.length)} />
          </section>

          <Card className="mb-6">
            {available.length > 1 && (
              <div className="mb-3 flex gap-2">
                {available.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    aria-pressed={current === m}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      current === m ? "bg-accent text-accent-foreground" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {METRICS[m].label}
                  </button>
                ))}
              </div>
            )}
            <h2 className="mb-1 text-sm font-semibold">
              {METRICS[current].label} por sessão ({METRICS[current].unit})
            </h2>
            {points.length >= 2 ? (
              <LineChart points={points} unit={METRICS[current].unit} label={METRICS[current].label} />
            ) : (
              <p className="py-6 text-center text-sm text-muted">O gráfico aparece a partir da segunda sessão.</p>
            )}
          </Card>

          <h2 className="mb-3 text-lg font-semibold">Sessões</h2>
          <ul className="flex flex-col gap-3">
            {[...sessions].reverse().map((s) => (
              <li key={s.workoutId}>
                <Link href={`/treino/resumo?id=${s.workoutId}`} className="block rounded-2xl bg-surface p-4">
                  <p className="text-sm font-semibold first-letter:uppercase">{dayFormat.format(new Date(s.date))}</p>
                  <p className="mt-1 text-sm text-muted tabular-nums">
                    {s.sets.map((set) => (set.weight_kg ? `${formatKg(set.weight_kg)} × ${set.reps}` : `${set.reps} reps`)).join(" · ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function RecordTile({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl bg-surface p-3">
      <p className="text-xs leading-tight text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value ?? "—"}</p>
    </div>
  );
}
