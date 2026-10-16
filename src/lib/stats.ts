import { db } from "./db";
import type { MuscleGroup } from "./exercises";
import type { Workout, WorkoutSet } from "./types";

// Pure statistics over logged sets: estimated 1RM, records (PRs), per
// session history and weekly volume. Loading helpers at the bottom.

/** Epley estimate. Null outside 1-15 reps, where the formula stops being useful. */
export function estimate1rm(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || reps < 1 || reps > 15) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/** A completed working set with its workout's date. */
export interface LoggedSet extends WorkoutSet {
  workout_started_at: string;
}

export type RecordKind = "e1rm" | "weight" | "reps";

export const RECORD_LABELS: Record<RecordKind, string> = {
  e1rm: "1RM estimado",
  weight: "Maior carga",
  reps: "Mais repetições",
};

export interface Records {
  e1rm: number | null;
  weight: number | null;
  /** Most reps in one set. Only tracked for sets without load. */
  reps: number | null;
}

export function recordsOf(sets: Pick<WorkoutSet, "weight_kg" | "reps">[]): Records {
  let e1rm: number | null = null;
  let weight: number | null = null;
  let reps: number | null = null;
  for (const s of sets) {
    const e = estimate1rm(s.weight_kg, s.reps);
    if (e !== null && (e1rm === null || e > e1rm)) e1rm = e;
    if (s.weight_kg && (weight === null || s.weight_kg > weight)) weight = s.weight_kg;
    if (!s.weight_kg && s.reps && (reps === null || s.reps > reps)) reps = s.reps;
  }
  return { e1rm, weight, reps };
}

/**
 * Records a set beats against an earlier baseline. A first-ever session has
 * no baseline, so it sets no records (avoids a trophy on every new exercise).
 */
export function recordsBeaten(set: Pick<WorkoutSet, "weight_kg" | "reps">, baseline: Records): RecordKind[] {
  const beaten: RecordKind[] = [];
  const e = estimate1rm(set.weight_kg, set.reps);
  if (e !== null && baseline.e1rm !== null && e > baseline.e1rm + 1e-9) beaten.push("e1rm");
  if (set.weight_kg && baseline.weight !== null && set.weight_kg > baseline.weight) beaten.push("weight");
  if (!set.weight_kg && set.reps && baseline.reps !== null && set.reps > baseline.reps) beaten.push("reps");
  return beaten;
}

/**
 * Records set inside one workout, per set id. Each set is compared with all
 * earlier workouts plus the earlier sets of this workout, so only the set
 * that first beats a record gets it.
 */
export function recordsInWorkout(workoutSets: WorkoutSet[], earlier: WorkoutSet[]): Map<string, RecordKind[]> {
  const result = new Map<string, RecordKind[]>();
  const byExercise = new Map<string, WorkoutSet[]>();
  for (const s of earlier) byExercise.set(s.exercise_id, [...(byExercise.get(s.exercise_id) ?? []), s]);

  const ordered = workoutSets
    .filter((s) => s.completed_at && !s.is_warmup && !s.deleted_at)
    .sort((a, b) => a.completed_at!.localeCompare(b.completed_at!));
  const hadHistory = new Set(byExercise.keys());
  for (const set of ordered) {
    const history = byExercise.get(set.exercise_id) ?? [];
    if (hadHistory.has(set.exercise_id)) {
      const beaten = recordsBeaten(set, recordsOf(history));
      if (beaten.length) result.set(set.id, beaten);
    }
    byExercise.set(set.exercise_id, [...history, set]);
  }
  return result;
}

export interface Session {
  workoutId: string;
  date: string;
  sets: LoggedSet[];
  bestE1rm: number | null;
  maxWeight: number | null;
  maxReps: number | null;
  volume: number;
}

/** Group one exercise's sets into sessions, oldest first. */
export function sessionsOf(sets: LoggedSet[]): Session[] {
  const map = new Map<string, LoggedSet[]>();
  for (const s of sets) map.set(s.workout_id, [...(map.get(s.workout_id) ?? []), s]);
  return [...map.values()]
    .map((list) => {
      const sorted = list.sort((a, b) => a.set_index - b.set_index);
      const records = recordsOf(sorted);
      return {
        workoutId: sorted[0].workout_id,
        date: sorted[0].workout_started_at,
        sets: sorted,
        bestE1rm: records.e1rm,
        maxWeight: records.weight,
        maxReps: Math.max(...sorted.map((s) => s.reps ?? 0)) || null,
        volume: sorted.reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Working sets per muscle group for sets completed on or after `since`. */
export function setsPerMuscleGroup(
  sets: Pick<WorkoutSet, "exercise_id" | "completed_at">[],
  groupOf: (exerciseId: string) => MuscleGroup | undefined,
  since: Date,
): Map<MuscleGroup, number> {
  const counts = new Map<MuscleGroup, number>();
  for (const s of sets) {
    if (!s.completed_at || Date.parse(s.completed_at) < since.getTime()) continue;
    const group = groupOf(s.exercise_id);
    if (group) counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return counts;
}

/** Monday 00:00 local time of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/** Finished, not deleted workouts, newest first. */
export async function listFinishedWorkouts(userId: string): Promise<Workout[]> {
  const workouts = await db.workouts
    .where("user_id")
    .equals(userId)
    .filter((w) => !w.deleted_at && !!w.finished_at)
    .toArray();
  return workouts.sort((a, b) => b.started_at.localeCompare(a.started_at));
}

/**
 * Completed working sets of finished workouts, optionally for one exercise.
 * `excludeWorkoutId` leaves one workout out (the one being compared).
 */
export async function loadLoggedSets(
  userId: string,
  options: { exerciseId?: string; excludeWorkoutId?: string } = {},
): Promise<LoggedSet[]> {
  const workouts = new Map((await listFinishedWorkouts(userId)).map((w) => [w.id, w]));
  const query = options.exerciseId
    ? db.workout_sets.where("[user_id+exercise_id]").equals([userId, options.exerciseId])
    : db.workout_sets.where("user_id").equals(userId);
  const sets = await query
    .filter(
      (s) =>
        !s.deleted_at &&
        !!s.completed_at &&
        !s.is_warmup &&
        s.workout_id !== options.excludeWorkoutId &&
        workouts.has(s.workout_id),
    )
    .toArray();
  return sets.map((s) => ({ ...s, workout_started_at: workouts.get(s.workout_id)!.started_at }));
}
