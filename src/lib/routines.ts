import { db, newRowFields, touchedFields } from "./db";
import type { MuscleGroup, Equipment } from "./exercises";
import type { Template } from "./templates";
import type { CustomExercise, Routine, RoutineExercise } from "./types";

// Data operations for routines (fichas) and custom exercises. All writes go
// to IndexedDB and mark rows dirty; the sync engine pushes them later.

export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = "10-12";
export const DEFAULT_REST_SECONDS = 90;

const live = <T extends { deleted_at: string | null }>(row: T) => !row.deleted_at;

export function listRoutines(userId: string): Promise<Routine[]> {
  return db.routines.where("user_id").equals(userId).filter(live).sortBy("position");
}

export function listRoutineExercises(routineId: string): Promise<RoutineExercise[]> {
  return db.routine_exercises.where("routine_id").equals(routineId).filter(live).sortBy("position");
}

async function nextRoutinePosition(userId: string): Promise<number> {
  const routines = await listRoutines(userId);
  return routines.length ? routines[routines.length - 1].position + 1 : 0;
}

export async function createRoutine(userId: string, name: string): Promise<string> {
  const routine: Routine = {
    ...newRowFields(userId),
    name,
    notes: null,
    position: await nextRoutinePosition(userId),
  };
  await db.routines.add(routine);
  return routine.id;
}

export async function updateRoutine(id: string, changes: Partial<Pick<Routine, "name" | "notes">>) {
  await db.routines.update(id, { ...changes, ...touchedFields() });
}

/** Soft delete the routine and its exercises. Past workouts keep their data. */
export async function deleteRoutine(id: string) {
  const now = new Date().toISOString();
  await db.transaction("rw", db.routines, db.routine_exercises, async () => {
    await db.routines.update(id, { deleted_at: now, ...touchedFields() });
    await db.routine_exercises
      .where("routine_id")
      .equals(id)
      .filter(live)
      .modify({ deleted_at: now, ...touchedFields() });
  });
}

/** Swap a routine with its neighbour. `direction` is -1 (up) or 1 (down). */
export async function moveRoutine(userId: string, id: string, direction: -1 | 1) {
  await swapPositions(await listRoutines(userId), id, direction, (rowId, position) =>
    db.routines.update(rowId, { position, ...touchedFields() }),
  );
}

export async function addExercisesToRoutine(userId: string, routineId: string, exerciseIds: string[]) {
  const existing = await listRoutineExercises(routineId);
  let position = existing.length ? existing[existing.length - 1].position + 1 : 0;
  const rows: RoutineExercise[] = exerciseIds.map((exercise_id) => ({
    ...newRowFields(userId),
    routine_id: routineId,
    exercise_id,
    position: position++,
    target_sets: DEFAULT_SETS,
    target_reps: DEFAULT_REPS,
    rest_seconds: DEFAULT_REST_SECONDS,
    notes: null,
  }));
  await db.routine_exercises.bulkAdd(rows);
}

export async function updateRoutineExercise(
  id: string,
  changes: Partial<Pick<RoutineExercise, "target_sets" | "target_reps" | "rest_seconds" | "notes">>,
) {
  await db.routine_exercises.update(id, { ...changes, ...touchedFields() });
}

export async function removeRoutineExercise(id: string) {
  await db.routine_exercises.update(id, {
    deleted_at: new Date().toISOString(),
    ...touchedFields(),
  });
}

export async function moveRoutineExercise(routineId: string, id: string, direction: -1 | 1) {
  await swapPositions(await listRoutineExercises(routineId), id, direction, (rowId, position) =>
    db.routine_exercises.update(rowId, { position, ...touchedFields() }),
  );
}

/** Create one routine per template day. Returns the new routine ids. */
export async function applyTemplate(userId: string, template: Template): Promise<string[]> {
  return db.transaction("rw", db.routines, db.routine_exercises, async () => {
    let position = await nextRoutinePosition(userId);
    const ids: string[] = [];
    for (const day of template.routines) {
      const routine: Routine = { ...newRowFields(userId), name: day.name, notes: null, position: position++ };
      await db.routines.add(routine);
      await db.routine_exercises.bulkAdd(
        day.exercises.map(([exercise_id, target_sets, target_reps, rest_seconds], index) => ({
          ...newRowFields(userId),
          routine_id: routine.id,
          exercise_id,
          position: index,
          target_sets,
          target_reps,
          rest_seconds,
          notes: null,
        })),
      );
      ids.push(routine.id);
    }
    return ids;
  });
}

export async function createCustomExercise(
  userId: string,
  values: { name: string; muscle_group: MuscleGroup; equipment: Equipment | null },
): Promise<string> {
  const exercise: CustomExercise = { ...newRowFields(userId), ...values };
  await db.custom_exercises.add(exercise);
  return exercise.id;
}

async function swapPositions(
  rows: { id: string; position: number }[],
  id: string,
  direction: -1 | 1,
  save: (id: string, position: number) => Promise<unknown>,
) {
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return;
  const target = index + direction;
  const reordered = [...rows];
  if (target >= 0 && target < rows.length) {
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  }
  // Renumber 0..n-1 so repeated positions (e.g. after a sync merge) heal too.
  await db.transaction("rw", db.routines, db.routine_exercises, async () => {
    for (const [position, row] of reordered.entries()) {
      if (row.position !== position) await save(row.id, position);
    }
  });
}
