// Row shapes shared by IndexedDB (Dexie) and Supabase. Field names match the
// SQL columns in supabase/migrations so the sync layer needs no mapping.

/** Columns every synced row carries. */
export interface SyncFields {
  id: string;
  user_id: string;
  created_at: string;
  /** Client clock. Last write wins on conflict. */
  updated_at: string;
  deleted_at: string | null;
}

/** Local-only flag: 1 when the row has changes not yet pushed to Supabase. */
export interface LocalFields {
  dirty: 0 | 1;
}

export type Sex = "m" | "f";
export type Goal = "hypertrophy" | "strength" | "fat_loss" | "conditioning";
export type Level = "beginner" | "intermediate" | "advanced";

export interface Profile extends SyncFields, LocalFields {
  name: string;
  sex: Sex | null;
  birth_year: number | null;
  height_cm: number | null;
  goal: Goal | null;
  level: Level | null;
  days_per_week: number | null;
}

export interface CustomExercise extends SyncFields, LocalFields {
  name: string;
  muscle_group: string;
  equipment: string | null;
}

export interface Routine extends SyncFields, LocalFields {
  name: string;
  notes: string | null;
  position: number;
}

export interface RoutineExercise extends SyncFields, LocalFields {
  routine_id: string;
  exercise_id: string;
  position: number;
  target_sets: number;
  target_reps: string | null;
  rest_seconds: number;
  notes: string | null;
}

export interface Workout extends SyncFields, LocalFields {
  routine_id: string | null;
  name: string;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
}

export interface WorkoutSet extends SyncFields, LocalFields {
  workout_id: string;
  exercise_id: string;
  set_index: number;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  is_warmup: boolean;
  completed_at: string | null;
}

export interface BodyMeasurement extends SyncFields, LocalFields {
  measured_on: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  calf_cm: number | null;
  notes: string | null;
}

export interface ProgressPhoto extends SyncFields, LocalFields {
  taken_on: string;
  storage_path: string;
  pose: "front" | "side" | "back" | "other" | null;
}

export const GOAL_LABELS: Record<Goal, string> = {
  hypertrophy: "Hipertrofia",
  strength: "Força",
  fat_loss: "Emagrecimento",
  conditioning: "Condicionamento",
};

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};
