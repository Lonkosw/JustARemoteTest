import Dexie, { type EntityTable } from "dexie";
import type {
  BodyMeasurement,
  CustomExercise,
  Profile,
  ProgressPhoto,
  Routine,
  RoutineExercise,
  SyncFields,
  Workout,
  WorkoutSet,
} from "./types";

/** Key/value store for app state such as sync cursors. */
export interface MetaEntry {
  key: string;
  value: unknown;
}

/**
 * Local database. Every screen reads and writes here first, so the app works
 * without network. Table names match the Supabase tables.
 */
export const db = new Dexie("treino") as Dexie & {
  profiles: EntityTable<Profile, "id">;
  custom_exercises: EntityTable<CustomExercise, "id">;
  routines: EntityTable<Routine, "id">;
  routine_exercises: EntityTable<RoutineExercise, "id">;
  workouts: EntityTable<Workout, "id">;
  workout_sets: EntityTable<WorkoutSet, "id">;
  body_measurements: EntityTable<BodyMeasurement, "id">;
  progress_photos: EntityTable<ProgressPhoto, "id">;
  meta: EntityTable<MetaEntry, "key">;
};

db.version(1).stores({
  profiles: "id, user_id, dirty",
  custom_exercises: "id, user_id, dirty",
  routines: "id, user_id, dirty",
  routine_exercises: "id, user_id, routine_id, dirty",
  workouts: "id, user_id, routine_id, started_at, dirty",
  workout_sets: "id, user_id, workout_id, [user_id+exercise_id], dirty",
  body_measurements: "id, user_id, measured_on, dirty",
  progress_photos: "id, user_id, taken_on, dirty",
  meta: "key",
});

// v2: workout_sets gains exercise_position (not indexed). Old rows get 0.
db.version(2)
  .stores({})
  .upgrade((tx) =>
    tx
      .table("workout_sets")
      .toCollection()
      .modify((row) => {
        row.exercise_position ??= 0;
      }),
  );

export const SYNCED_TABLES = [
  "profiles",
  "custom_exercises",
  "routines",
  "routine_exercises",
  "workouts",
  "workout_sets",
  "body_measurements",
  "progress_photos",
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

/** Sync columns for a new row owned by `userId`. */
export function newRowFields(userId: string, id: string = crypto.randomUUID()) {
  const now = new Date().toISOString();
  return {
    id,
    user_id: userId,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    dirty: 1 as const,
  } satisfies SyncFields & { dirty: 1 };
}

/** Fields to merge into a row being edited locally. */
export function touchedFields() {
  return { updated_at: new Date().toISOString(), dirty: 1 as const };
}

/** True when some local change has not reached Supabase yet. */
export async function hasUnsyncedChanges(): Promise<boolean> {
  for (const name of SYNCED_TABLES) {
    if ((await db.table(name).where("dirty").equals(1).count()) > 0) return true;
  }
  return false;
}

/** Remove every local row. Used on sign out. */
export async function clearLocalData() {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}
