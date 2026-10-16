"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSignedIn } from "@/components/auth-provider";
import { ExercisePicker } from "@/components/exercise-picker";
import { CheckIcon, TrashIcon } from "@/components/icons";
import { useRestTimer } from "@/components/rest-timer";
import { Splash } from "@/components/splash";
import { Button, Card } from "@/components/ui";
import { MUSCLE_GROUPS, type ExerciseInfo } from "@/lib/exercises";
import { DEFAULT_REST_SECONDS, listRoutineExercises } from "@/lib/routines";
import type { RoutineExercise, Workout, WorkoutSet } from "@/lib/types";
import { useExercises } from "@/lib/use-exercises";
import {
  addExercisesToWorkout,
  addSet,
  discardWorkout,
  finishWorkout,
  formatDuration,
  formatKg,
  getActiveWorkout,
  getPreviousSets,
  listWorkoutSets,
  parseRepRange,
  removeExerciseFromWorkout,
  removeSet,
  suggestNext,
  updateSet,
  type Suggestion,
} from "@/lib/workouts";

export default function WorkoutPage() {
  const { userId } = useSignedIn();
  // null once loaded and none is active.
  const workout = useLiveQuery(() => getActiveWorkout(userId), [userId]);

  if (workout === undefined) return <Splash />;
  if (workout === null) {
    return (
      <Card className="text-center">
        <p className="text-muted">Nenhum treino em andamento.</p>
        <Link href="/" className="mt-2 inline-block font-semibold text-accent">
          Escolher treino
        </Link>
      </Card>
    );
  }
  return <ActiveWorkout key={workout.id} workout={workout} userId={userId} />;
}

interface ExerciseGroup {
  position: number;
  exerciseId: string;
  sets: WorkoutSet[];
}

function ActiveWorkout({ workout, userId }: { workout: Workout; userId: string }) {
  const router = useRouter();
  const { byId } = useExercises(userId);
  const [picking, setPicking] = useState(false);
  useWakeLock();

  const sets = useLiveQuery(() => listWorkoutSets(workout.id), [workout.id]);
  const planned = useLiveQuery(
    async () => (workout.routine_id ? listRoutineExercises(workout.routine_id) : []),
    [workout.routine_id],
  );

  const groups = useMemo(() => {
    const map = new Map<number, ExerciseGroup>();
    for (const s of sets ?? []) {
      const group = map.get(s.exercise_position) ?? { position: s.exercise_position, exerciseId: s.exercise_id, sets: [] };
      group.sets.push(s);
      map.set(s.exercise_position, group);
    }
    return [...map.values()]
      .sort((a, b) => a.position - b.position)
      .map((g) => ({ ...g, sets: g.sets.sort((a, b) => a.set_index - b.set_index) }));
  }, [sets]);

  if (!sets || !planned) return <Splash />;

  const completed = sets.filter((s) => s.completed_at).length;

  async function finish() {
    if (completed === 0) {
      if (confirm("Nenhuma série concluída. Descartar este treino?")) {
        await discardWorkout(workout.id);
        router.replace("/");
      }
      return;
    }
    const pending = sets!.length - completed;
    const message = pending
      ? `${pending} ${pending === 1 ? "série não concluída será descartada" : "séries não concluídas serão descartadas"}. Finalizar treino?`
      : "Finalizar treino?";
    if (!confirm(message)) return;
    await finishWorkout(workout.id);
    router.replace(`/treino/resumo?id=${workout.id}`);
  }

  async function discard() {
    if (!confirm("Descartar este treino? As séries registradas serão apagadas.")) return;
    await discardWorkout(workout.id);
    router.replace("/");
  }

  return (
    <>
      <header className="sticky top-0 z-[5] -mx-4 mb-4 flex items-center gap-3 bg-background/95 px-4 pt-[env(safe-area-inset-top)] pb-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{workout.name}</h1>
          <p className="text-sm text-muted tabular-nums">
            <Elapsed since={workout.started_at} /> · {completed}/{sets.length} séries
          </p>
        </div>
        <Button size="sm" onClick={finish}>
          Finalizar
        </Button>
      </header>

      <div className="flex flex-col gap-4">
        {groups.map((group) => {
          const plan = planned.find((p) => p.exercise_id === group.exerciseId);
          return (
            <ExerciseBlock
              key={group.position}
              userId={userId}
              workout={workout}
              group={group}
              exercise={byId.get(group.exerciseId)}
              plan={plan}
            />
          );
        })}
      </div>

      {groups.length === 0 && (
        <Card className="text-center text-muted">Adicione o primeiro exercício.</Card>
      )}

      <Button variant="secondary" className="mt-4" onClick={() => setPicking(true)}>
        + Adicionar exercício
      </Button>
      <button onClick={discard} className="mx-auto mt-8 block text-sm font-semibold text-danger">
        Descartar treino
      </button>

      {picking && (
        <ExercisePicker
          userId={userId}
          onClose={() => setPicking(false)}
          onConfirm={async (ids) => {
            await addExercisesToWorkout(userId, workout.id, ids);
            setPicking(false);
          }}
        />
      )}
    </>
  );
}

function ExerciseBlock({
  userId,
  workout,
  group,
  exercise,
  plan,
}: {
  userId: string;
  workout: Workout;
  group: ExerciseGroup;
  exercise: ExerciseInfo | undefined;
  plan: RoutineExercise | undefined;
}) {
  const previous = useLiveQuery(
    () => getPreviousSets(userId, group.exerciseId, workout.id),
    [userId, group.exerciseId, workout.id],
  );
  const range = parseRepRange(plan?.target_reps ?? null);
  const suggestion = previous ? suggestNext(previous, range, exercise?.equipment ?? null) : null;
  const rest = plan?.rest_seconds ?? DEFAULT_REST_SECONDS;

  let working = 0;
  const rows = group.sets.map((set) => ({ set, label: set.is_warmup ? "A" : String(++working) }));

  async function removeLast() {
    const last = [...group.sets].reverse().find((s) => !s.completed_at) ?? group.sets.at(-1);
    if (last) await removeSet(last.id);
  }

  async function removeExercise() {
    if (confirm(`Remover ${exercise?.name ?? "exercício"} deste treino?`)) {
      await removeExerciseFromWorkout(workout.id, group.position);
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-4">
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{exercise?.name ?? "Exercício"}</h2>
          <p className="text-sm text-muted">
            {exercise && MUSCLE_GROUPS[exercise.muscle_group]}
            {plan?.target_reps && ` · Meta ${plan.target_reps}`}
          </p>
        </div>
        <button aria-label="Remover exercício" onClick={removeExercise} className="p-1.5 text-muted">
          <TrashIcon />
        </button>
      </div>

      {suggestion?.progressed && (
        <p className="mb-2 rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">
          Bateu a meta na última vez. Sugestão: {suggestion.weight_kg ? `${formatKg(suggestion.weight_kg)} kg × ` : ""}
          {suggestion.reps} reps
        </p>
      )}

      <div className="grid grid-cols-[2rem_1fr_4.5rem_4rem_2.75rem] items-center gap-x-2 gap-y-1.5 text-center">
        <span className="text-xs text-muted">Série</span>
        <span className="text-xs text-muted">Anterior</span>
        <span className="text-xs text-muted">kg</span>
        <span className="text-xs text-muted">Reps</span>
        <span />
        {rows.map(({ set, label }) => {
          const workingIndex = set.is_warmup ? -1 : Number(label) - 1;
          const prev = workingIndex >= 0 ? (previous?.[workingIndex] ?? previous?.at(-1)) : undefined;
          return (
            <SetRow
              key={set.id}
              set={set}
              label={label}
              previous={prev}
              suggestion={suggestion}
              minReps={range?.[0] ?? null}
              rest={rest}
            />
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => addSet(userId, workout.id, group.exerciseId, group.position)}
          className="h-10 rounded-xl bg-surface-2 text-sm font-semibold"
        >
          + Série
        </button>
        <button
          onClick={removeLast}
          disabled={group.sets.length === 0}
          className="h-10 rounded-xl bg-surface-2 text-sm font-semibold text-muted disabled:opacity-40"
        >
          − Série
        </button>
      </div>
    </section>
  );
}

function parseNumber(value: string): number | null {
  const n = Number(value.replace(",", ".").trim());
  return value.trim() === "" || Number.isNaN(n) || n < 0 ? null : n;
}

function SetRow({
  set,
  label,
  previous,
  suggestion,
  minReps,
  rest,
}: {
  set: WorkoutSet;
  label: string;
  previous: WorkoutSet | undefined;
  suggestion: Suggestion | null;
  minReps: number | null;
  rest: number;
}) {
  const timer = useRestTimer();
  const [weight, setWeight] = useState(set.weight_kg?.toString().replace(".", ",") ?? "");
  const [reps, setReps] = useState(set.reps?.toString() ?? "");
  const repsInput = useRef<HTMLInputElement>(null);
  const done = !!set.completed_at;

  // Placeholders: progression suggestion, else last time, else the plan.
  const usePlan = suggestion?.progressed && !set.is_warmup;
  const weightHint = usePlan ? suggestion.weight_kg : (previous?.weight_kg ?? null);
  const repsHint = usePlan ? suggestion.reps : (previous?.reps ?? minReps);

  function commit() {
    const w = parseNumber(weight);
    const r = parseNumber(reps);
    const roundedReps = r === null ? null : Math.round(r);
    if (w !== set.weight_kg || roundedReps !== set.reps) {
      void updateSet(set.id, { weight_kg: w, reps: roundedReps });
    }
  }

  async function toggleDone() {
    if (done) {
      await updateSet(set.id, { completed_at: null });
      return;
    }
    const w = parseNumber(weight) ?? weightHint;
    const r = parseNumber(reps) ?? repsHint;
    if (r === null) {
      repsInput.current?.focus();
      return;
    }
    const roundedReps = Math.round(r);
    setWeight(w === null ? "" : String(w).replace(".", ","));
    setReps(String(roundedReps));
    await updateSet(set.id, { weight_kg: w, reps: roundedReps, completed_at: new Date().toISOString() });
    if (!set.is_warmup) timer.start(rest);
  }

  const inputClass = `h-10 w-full rounded-lg text-center font-semibold tabular-nums outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-accent ${
    done ? "bg-accent/15" : "bg-surface-2"
  }`;

  return (
    <>
      <button
        onClick={() => !done && updateSet(set.id, { is_warmup: !set.is_warmup })}
        aria-label={set.is_warmup ? "Série de aquecimento. Tocar para virar série válida" : `Série ${label}. Tocar para marcar como aquecimento`}
        className={`h-10 rounded-lg text-sm font-bold ${set.is_warmup ? "text-amber-400" : "text-muted"}`}
      >
        {label}
      </button>
      <span className="truncate text-sm text-muted tabular-nums">
        {previous ? `${formatKg(previous.weight_kg)} × ${previous.reps ?? "—"}` : "—"}
      </span>
      <input
        inputMode="decimal"
        aria-label={`Carga da série ${label}`}
        placeholder={weightHint === null ? "" : formatKg(weightHint)}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={commit}
        className={inputClass}
      />
      <input
        ref={repsInput}
        inputMode="numeric"
        aria-label={`Repetições da série ${label}`}
        placeholder={repsHint === null ? "" : String(repsHint)}
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={commit}
        className={inputClass}
      />
      <button
        aria-label={done ? `Desmarcar série ${label}` : `Concluir série ${label}`}
        aria-pressed={done}
        onClick={toggleDone}
        className={`flex h-10 items-center justify-center rounded-lg ${
          done ? "bg-accent text-accent-foreground" : "bg-surface-2 text-muted"
        }`}
      >
        <CheckIcon />
      </button>
    </>
  );
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{formatDuration(now - Date.parse(since))}</>;
}

/** Keep the screen on during the workout, where supported. */
function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const request = async () => {
      try {
        if (document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen");
        if (released) void lock?.release();
      } catch {
        // Denied (battery saver, iframe): the app works without it.
      }
    };
    void request();
    const onVisible = () => void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);
}
