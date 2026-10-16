"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSignedIn } from "@/components/auth-provider";
import { Splash } from "@/components/splash";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { useExercises } from "@/lib/use-exercises";
import { formatDuration, formatKg, listWorkoutSets, workoutVolume } from "@/lib/workouts";

export default function SummaryPage() {
  return (
    <Suspense fallback={<Splash />}>
      <Summary />
    </Suspense>
  );
}

function Summary() {
  const id = useSearchParams().get("id") ?? "";
  const { userId } = useSignedIn();
  const { byId } = useExercises(userId);
  const data = useLiveQuery(async () => {
    const workout = await db.workouts.get(id);
    if (!workout || workout.deleted_at || workout.user_id !== userId) return null;
    return { workout, sets: await listWorkoutSets(id) };
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

  const { workout, sets } = data;
  const done = sets.filter((s) => s.completed_at && !s.is_warmup);
  const duration = Date.parse(workout.finished_at ?? new Date().toISOString()) - Date.parse(workout.started_at);

  const byExercise = new Map<string, typeof done>();
  for (const s of [...done].sort((a, b) => a.exercise_position - b.exercise_position || a.set_index - b.set_index)) {
    byExercise.set(s.exercise_id, [...(byExercise.get(s.exercise_id) ?? []), s]);
  }

  return (
    <>
      <p className="text-sm font-semibold text-accent">Treino concluído</p>
      <h1 className="mb-5 text-2xl font-bold">{workout.name}</h1>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Duração" value={formatDuration(duration)} />
        <Stat label="Séries" value={String(done.length)} />
        <Stat label="Volume" value={`${formatKg(Math.round(workoutVolume(sets)))} kg`} />
      </div>

      <ul className="flex flex-col gap-3">
        {[...byExercise.entries()].map(([exerciseId, list]) => (
          <li key={exerciseId}>
            <Card>
              <p className="font-semibold">{byId.get(exerciseId)?.name ?? "Exercício"}</p>
              <p className="mt-1 text-sm text-muted tabular-nums">
                {list.map((s) => (s.weight_kg === null ? `${s.reps} reps` : `${formatKg(s.weight_kg)} kg × ${s.reps}`)).join(" · ")}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <Link
        href="/"
        className="mt-6 flex h-12 items-center justify-center rounded-xl bg-accent font-semibold text-accent-foreground"
      >
        Concluir
      </Link>
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
