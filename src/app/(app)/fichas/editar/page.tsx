"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useSignedIn } from "@/components/auth-provider";
import { ExercisePicker } from "@/components/exercise-picker";
import {
  BackIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { Splash } from "@/components/splash";
import { Button, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { MUSCLE_GROUPS, type ExerciseInfo } from "@/lib/exercises";
import {
  addExercisesToRoutine,
  deleteRoutine,
  listRoutineExercises,
  moveRoutineExercise,
  removeRoutineExercise,
  updateRoutine,
  updateRoutineExercise,
} from "@/lib/routines";
import type { RoutineExercise } from "@/lib/types";
import { useExercises } from "@/lib/use-exercises";

// The routine id is a query param (not a [id] segment) so this page has one
// static URL that the service worker can cache for offline use.
export default function EditRoutinePage() {
  return (
    <Suspense fallback={<Splash />}>
      <RoutineEditor />
    </Suspense>
  );
}

const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

function formatRest(seconds: number) {
  if (seconds === 0) return "Sem descanso";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m === 0 ? `${s}s` : s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, "0")} min`;
}

function RoutineEditor() {
  const id = useSearchParams().get("id") ?? "";
  const { userId } = useSignedIn();
  const router = useRouter();
  const { byId } = useExercises(userId);
  const [picking, setPicking] = useState(false);

  // null once loaded and missing, so it differs from undefined (loading).
  const routine = useLiveQuery(async () => (await db.routines.get(id)) ?? null, [id]);
  const items = useLiveQuery(() => listRoutineExercises(id), [id]);

  if (routine === undefined || items === undefined) return <Splash />;

  if (routine === null || routine.deleted_at || routine.user_id !== userId) {
    return (
      <Card className="text-center">
        <p className="text-muted">Ficha não encontrada.</p>
        <Link href="/fichas" className="mt-2 inline-block font-semibold text-accent">
          Voltar para fichas
        </Link>
      </Card>
    );
  }

  async function remove() {
    if (!confirm(`Excluir a ficha "${routine!.name}"? Treinos já feitos continuam no histórico.`)) return;
    await deleteRoutine(id);
    router.replace("/fichas");
  }

  return (
    <>
      <header className="mb-5 flex items-center gap-2">
        <Link href="/fichas" aria-label="Voltar" className="-ml-2 p-2">
          <BackIcon />
        </Link>
        <NameInput key={routine.id} initial={routine.name} onSave={(name) => updateRoutine(id, { name })} />
      </header>

      {items.length === 0 && (
        <Card className="mb-4 text-center text-muted">Ficha vazia. Adicione os exercícios.</Card>
      )}

      <ol className="flex flex-col gap-3">
        {items.map((item, index) => (
          <ExerciseItem
            key={item.id}
            item={item}
            exercise={byId.get(item.exercise_id)}
            isFirst={index === 0}
            isLast={index === items.length - 1}
            onMove={(direction) => moveRoutineExercise(id, item.id, direction)}
          />
        ))}
      </ol>

      <Button variant="secondary" className="mt-4" onClick={() => setPicking(true)}>
        + Adicionar exercício
      </Button>

      <button
        onClick={remove}
        className="mx-auto mt-10 flex items-center gap-2 text-sm font-semibold text-danger"
      >
        <TrashIcon /> Excluir ficha
      </button>

      {picking && (
        <ExercisePicker
          userId={userId}
          onClose={() => setPicking(false)}
          onConfirm={async (ids) => {
            await addExercisesToRoutine(userId, id, ids);
            setPicking(false);
          }}
        />
      )}
    </>
  );
}

function NameInput({ initial, onSave }: { initial: string; onSave: (name: string) => void }) {
  const [value, setValue] = useState(initial);

  function commit() {
    const name = value.trim();
    if (!name) setValue(initial);
    else if (name !== initial) onSave(name);
  }

  return (
    <input
      aria-label="Nome da ficha"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="min-w-0 flex-1 rounded-lg bg-transparent px-1 text-2xl font-bold outline-none focus:bg-surface"
    />
  );
}

function ExerciseItem({
  item,
  exercise,
  isFirst,
  isLast,
  onMove,
}: {
  item: RoutineExercise;
  exercise: ExerciseInfo | undefined;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const [reps, setReps] = useState(item.target_reps ?? "");

  function commitReps() {
    const value = reps.trim() || null;
    if (value !== item.target_reps) updateRoutineExercise(item.id, { target_reps: value });
  }

  const setSets = (n: number) =>
    updateRoutineExercise(item.id, { target_sets: Math.min(20, Math.max(1, n)) });

  return (
    <li className="rounded-2xl bg-surface p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{exercise?.name ?? "Exercício removido"}</p>
          {exercise && <p className="text-sm text-muted">{MUSCLE_GROUPS[exercise.muscle_group]}</p>}
        </div>
        <IconButton label="Mover para cima" disabled={isFirst} onClick={() => onMove(-1)}>
          <ChevronUpIcon />
        </IconButton>
        <IconButton label="Mover para baixo" disabled={isLast} onClick={() => onMove(1)}>
          <ChevronDownIcon />
        </IconButton>
        <IconButton label="Remover exercício" onClick={() => removeRoutineExercise(item.id)}>
          <TrashIcon />
        </IconButton>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <p className="mb-1 text-xs text-muted">Séries</p>
          <div className="flex h-11 items-center justify-between rounded-xl bg-surface-2">
            <button aria-label="Menos uma série" className="px-2.5" onClick={() => setSets(item.target_sets - 1)}>
              <MinusIcon />
            </button>
            <span className="font-semibold tabular-nums">{item.target_sets}</span>
            <button aria-label="Mais uma série" className="px-2.5" onClick={() => setSets(item.target_sets + 1)}>
              <PlusIcon />
            </button>
          </div>
        </div>
        <label>
          <span className="mb-1 block text-xs text-muted">Repetições</span>
          <input
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onBlur={commitReps}
            placeholder="10-12"
            className="h-11 w-full rounded-xl bg-surface-2 px-3 text-center font-semibold outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-muted">Descanso</span>
          <select
            value={item.rest_seconds}
            onChange={(e) => updateRoutineExercise(item.id, { rest_seconds: Number(e.target.value) })}
            className="h-11 w-full rounded-xl bg-surface-2 px-2 text-center font-semibold outline-none"
          >
            {[...new Set([...REST_OPTIONS, item.rest_seconds])]
              .sort((a, b) => a - b)
              .map((s) => (
                <option key={s} value={s}>
                  {formatRest(s)}
                </option>
              ))}
          </select>
        </label>
      </div>
    </li>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg p-1.5 text-muted disabled:opacity-30"
    >
      {children}
    </button>
  );
}
