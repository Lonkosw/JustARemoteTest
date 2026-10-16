"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSignedIn } from "@/components/auth-provider";
import { BackIcon, TrashIcon } from "@/components/icons";
import { Splash } from "@/components/splash";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { loadLoggedSets, RECORD_LABELS, recordsInWorkout } from "@/lib/stats";
import { useExercises } from "@/lib/use-exercises";
import { discardWorkout, formatDuration, formatKg, listWorkoutSets, workoutVolume } from "@/lib/workouts";

// Shown right after finishing a workout and when opening one from history.
export default function SummaryPage() {
  return (
    <Suspense fallback={<Splash />}>
      <Summary />
    </Suspense>
  );
}

const JUST_FINISHED_MS = 15 * 60_000;
const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

function Summary() {
  const id = useSearchParams().get("id") ?? "";
  const { userId } = useSignedIn();
  const router = useRouter();
  const { byId } = useExercises(userId);
  const data = useLiveQuery(async () => {
    const workout = await db.workouts.get(id);
    if (!workout || workout.deleted_at || workout.user_id !== userId) return null;
    const [sets, others] = await Promise.all([listWorkoutSets(id), loadLoggedSets(userId, { excludeWorkoutId: id })]);
    const earlier = others.filter((s) => s.workout_started_at < workout.started_at);
    return { workout, sets, records: recordsInWorkout(sets, earlier), now: Date.now() };
  }, [id, userId]);

  if (data === undefined) return <Splash />;
  if (data === null) {
    return (
      <Card className="text-center">
        <p className="text-muted">Treino não encontrado.</p>
        <Link href="/" className="mt-2 inline-block font-semibold text-accent">
          Início
        </Link>
      </Card>
    );
  }

  const { workout, sets, records, now } = data;
  const done = sets.filter((s) => s.completed_at && !s.is_warmup);
  const end = workout.finished_at ?? new Date(now).toISOString();
  const duration = Date.parse(end) - Date.parse(workout.started_at);
  const justFinished = !!workout.finished_at && now - Date.parse(workout.finished_at) < JUST_FINISHED_MS;

  const byExercise = new Map<string, typeof done>();
  for (const s of [...done].sort((a, b) => a.exercise_position - b.exercise_position || a.set_index - b.set_index)) {
    byExercise.set(s.exercise_id, [...(byExercise.get(s.exercise_id) ?? []), s]);
  }

  async function remove() {
    if (!confirm("Excluir este treino do histórico?")) return;
    await discardWorkout(workout.id);
    router.replace("/evolucao");
  }

  return (
    <>
      {justFinished ? (
        <p className="text-sm font-semibold text-accent">Treino concluído</p>
      ) : (
        <button aria-label="Voltar" onClick={() => router.back()} className="-ml-2 p-2">
          <BackIcon />
        </button>
      )}
      <h1 className="text-2xl font-bold">{workout.name}</h1>
      <p className="mb-5 text-sm text-muted first-letter:uppercase">{dayFormat.format(new Date(workout.started_at))}</p>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Duração" value={formatDuration(duration)} />
        <Stat label="Séries" value={String(done.length)} />
        <Stat label="Volume" value={`${formatKg(Math.round(workoutVolume(sets)))} kg`} />
      </div>

      {records.size > 0 && (
        <Card className="mb-4 border border-accent/40">
          <h2 className="mb-2 font-semibold">🏆 {records.size === 1 ? "Novo recorde" : `${records.size} novos recordes`}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {done
              .filter((s) => records.has(s.id))
              .map((s) => (
                <li key={s.id} className="flex justify-between gap-3">
                  <span>
                    {byId.get(s.exercise_id)?.name ?? "Exercício"}:{" "}
                    {s.weight_kg ? `${formatKg(s.weight_kg)} kg × ${s.reps}` : `${s.reps} reps`}
                  </span>
                  <span className="shrink-0 text-muted">{records.get(s.id)!.map((k) => RECORD_LABELS[k]).join(", ")}</span>
                </li>
              ))}
          </ul>
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {[...byExercise.entries()].map(([exerciseId, list]) => (
          <li key={exerciseId}>
            <Link href={`/evolucao/exercicio?id=${exerciseId}`} className="block rounded-2xl bg-surface p-4">
              <p className="font-semibold">{byId.get(exerciseId)?.name ?? "Exercício"}</p>
              <p className="mt-1 text-sm text-muted tabular-nums">
                {list
                  .map((s) => (s.weight_kg === null ? `${s.reps} reps` : `${formatKg(s.weight_kg)} kg × ${s.reps}`) + (records.has(s.id) ? " 🏆" : ""))
                  .join(" · ")}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {justFinished && (
        <Link
          href="/"
          className="mt-6 flex h-12 items-center justify-center rounded-xl bg-accent font-semibold text-accent-foreground"
        >
          Concluir
        </Link>
      )}
      <button onClick={remove} className="mx-auto mt-8 flex items-center gap-2 text-sm font-semibold text-danger">
        <TrashIcon /> Excluir treino
      </button>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
