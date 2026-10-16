import { db, newRowFields, touchedFields } from "./db";
import type { Equipment } from "./exercises";
import { DEFAULT_REST_SECONDS, listRoutineExercises } from "./routines";
import type { Workout, WorkoutSet } from "./types";

// Data operations for live workouts. A workout is active while finished_at
// is null; the app allows one active workout at a time.

const live = <T extends { deleted_at: string | null }>(row: T) => !row.deleted_at;

export async function getActiveWorkout(userId: string): Promise<Workout | null> {
  const active = await db.workouts
    .where("user_id")
    .equals(userId)
    .filter((w) => !w.deleted_at && !w.finished_at)
    .sortBy("started_at");
  return active.at(-1) ?? null;
}

export function listWorkoutSets(workoutId: string): Promise<WorkoutSet[]> {
  return db.workout_sets.where("workout_id").equals(workoutId).filter(live).toArray();
}

function newSet(
  userId: string,
  workoutId: string,
  exerciseId: string,
  exercisePosition: number,
  setIndex: number,
): WorkoutSet {
  return {
    ...newRowFields(userId),
    workout_id: workoutId,
    exercise_id: exerciseId,
    exercise_position: exercisePosition,
    set_index: setIndex,
    weight_kg: null,
    reps: null,
    rpe: null,
    is_warmup: false,
    completed_at: null,
  };
}

/** Start a workout, empty or with the sets planned in a routine. */
export async function startWorkout(userId: string, routineId: string | null): Promise<string> {
  return db.transaction("rw", [db.workouts, db.workout_sets, db.routines, db.routine_exercises], async () => {
    const routine = routineId ? await db.routines.get(routineId) : undefined;
    const workout: Workout = {
      ...newRowFields(userId),
      routine_id: routine?.id ?? null,
      name: routine?.name ?? "Treino livre",
      started_at: new Date().toISOString(),
      finished_at: null,
      notes: null,
    };
    await db.workouts.add(workout);

    if (routine) {
      const planned = await listRoutineExercises(routine.id);
      const sets = planned.flatMap((item, position) =>
        Array.from({ length: item.target_sets }, (_, index) =>
          newSet(userId, workout.id, item.exercise_id, position, index),
        ),
      );
      await db.workout_sets.bulkAdd(sets);
    }
    return workout.id;
  });
}

export async function addExercisesToWorkout(userId: string, workoutId: string, exerciseIds: string[]) {
  const sets = await listWorkoutSets(workoutId);
  let position = Math.max(-1, ...sets.map((s) => s.exercise_position)) + 1;
  await db.workout_sets.bulkAdd(
    exerciseIds.flatMap((exerciseId) => {
      const p = position++;
      return [0, 1, 2].map((index) => newSet(userId, workoutId, exerciseId, p, index));
    }),
  );
}

export async function addSet(userId: string, workoutId: string, exerciseId: string, exercisePosition: number) {
  const sets = (await listWorkoutSets(workoutId)).filter((s) => s.exercise_position === exercisePosition);
  const index = Math.max(-1, ...sets.map((s) => s.set_index)) + 1;
  await db.workout_sets.add(newSet(userId, workoutId, exerciseId, exercisePosition, index));
}

export async function updateSet(
  id: string,
  changes: Partial<Pick<WorkoutSet, "weight_kg" | "reps" | "is_warmup" | "completed_at">>,
) {
  await db.workout_sets.update(id, { ...changes, ...touchedFields() });
}

export async function removeSet(id: string) {
  await db.workout_sets.update(id, { deleted_at: new Date().toISOString(), ...touchedFields() });
}

export async function removeExerciseFromWorkout(workoutId: string, exercisePosition: number) {
  const now = new Date().toISOString();
  await db.workout_sets
    .where("workout_id")
    .equals(workoutId)
    .filter((s) => live(s) && s.exercise_position === exercisePosition)
    .modify({ deleted_at: now, ...touchedFields() });
}

/** Finish: drop sets never completed, then close the workout. */
export async function finishWorkout(workoutId: string) {
  const now = new Date().toISOString();
  await db.transaction("rw", db.workouts, db.workout_sets, async () => {
    await db.workout_sets
      .where("workout_id")
      .equals(workoutId)
      .filter((s) => live(s) && !s.completed_at)
      .modify({ deleted_at: now, ...touchedFields() });
    await db.workouts.update(workoutId, { finished_at: now, ...touchedFields() });
  });
}

/** Discard: soft delete the workout and all its sets. */
export async function discardWorkout(workoutId: string) {
  const now = new Date().toISOString();
  await db.transaction("rw", db.workouts, db.workout_sets, async () => {
    await db.workout_sets
      .where("workout_id")
      .equals(workoutId)
      .filter(live)
      .modify({ deleted_at: now, ...touchedFields() });
    await db.workouts.update(workoutId, { deleted_at: now, ...touchedFields() });
  });
}

/**
 * Working sets from the most recent other workout that completed this
 * exercise, ordered by set_index. Empty when never done before.
 */
export async function getPreviousSets(
  userId: string,
  exerciseId: string,
  excludeWorkoutId: string,
): Promise<WorkoutSet[]> {
  const sets = await db.workout_sets
    .where("[user_id+exercise_id]")
    .equals([userId, exerciseId])
    .filter((s) => live(s) && !!s.completed_at && !s.is_warmup && s.workout_id !== excludeWorkoutId)
    .toArray();
  if (!sets.length) return [];

  const latestByWorkout = new Map<string, string>();
  for (const s of sets) {
    const prev = latestByWorkout.get(s.workout_id);
    if (!prev || s.completed_at! > prev) latestByWorkout.set(s.workout_id, s.completed_at!);
  }
  const workouts = (await db.workouts.bulkGet([...latestByWorkout.keys()])).filter(
    (w): w is Workout => !!w && !w.deleted_at,
  );
  if (!workouts.length) return [];
  const latest = workouts.reduce((a, b) =>
    latestByWorkout.get(a.id)! >= latestByWorkout.get(b.id)! ? a : b,
  );
  return sets.filter((s) => s.workout_id === latest.id).sort((a, b) => a.set_index - b.set_index);
}

/** "8-12" gives [8, 12], "10" gives [10, 10]. Timed targets ("30s") give null. */
export function parseRepRange(target: string | null): [number, number] | null {
  if (!target) return null;
  const match = target.trim().match(/^(\d+)\s*(?:-|–|a)?\s*(\d+)?$/);
  if (!match) return null;
  const low = Number(match[1]);
  const high = match[2] ? Number(match[2]) : low;
  return [Math.min(low, high), Math.max(low, high)];
}

const INCREMENT_KG: Partial<Record<Equipment, number>> = {
  barbell: 2.5,
  ez_bar: 2.5,
  smith: 2.5,
  machine: 2.5,
  cable: 2.5,
  dumbbell: 2,
  kettlebell: 4,
};

export interface Suggestion {
  weight_kg: number | null;
  reps: number | null;
  /** True when the suggestion raises the load or reps over last time. */
  progressed: boolean;
}

/**
 * Double progression: when every working set last time reached the top of
 * the rep range, add load (or one rep for bodyweight). Otherwise repeat.
 */
export function suggestNext(
  previous: WorkoutSet[],
  target: [number, number] | null,
  equipment: Equipment | null,
): Suggestion | null {
  const done = previous.filter((s) => s.reps !== null);
  if (!done.length) return null;
  const last = done[done.length - 1];
  const heaviest = Math.max(...done.map((s) => s.weight_kg ?? 0));
  const hitTop = target !== null && done.every((s) => (s.reps ?? 0) >= target[1]);
  if (!hitTop) return { weight_kg: last.weight_kg, reps: last.reps, progressed: false };

  const step = equipment ? INCREMENT_KG[equipment] : undefined;
  if (step && heaviest > 0) {
    return { weight_kg: heaviest + step, reps: target![0], progressed: true };
  }
  return { weight_kg: last.weight_kg, reps: (last.reps ?? 0) + 1, progressed: true };
}

/** Rest for an exercise: from the routine when planned there, else default. */
export async function getRestSeconds(routineId: string | null, exerciseId: string): Promise<number> {
  if (!routineId) return DEFAULT_REST_SECONDS;
  const items = await listRoutineExercises(routineId);
  return items.find((i) => i.exercise_id === exerciseId)?.rest_seconds ?? DEFAULT_REST_SECONDS;
}

export function workoutVolume(sets: WorkoutSet[]): number {
  return sets
    .filter((s) => s.completed_at && !s.is_warmup)
    .reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
}

const kgFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function formatKg(kg: number | null): string {
  return kg === null ? "—" : kgFormat.format(kg);
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
