"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db } from "./db";
import { CATALOG, type Equipment, type ExerciseInfo, type MuscleGroup } from "./exercises";

/** Catalog plus the user's custom exercises, sorted by name. */
export function useExercises(userId: string) {
  const custom = useLiveQuery(
    () =>
      db.custom_exercises
        .where("user_id")
        .equals(userId)
        .filter((row) => !row.deleted_at)
        .toArray(),
    [userId],
  );

  return useMemo(() => {
    const all: ExerciseInfo[] = [
      ...CATALOG,
      ...(custom ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        muscle_group: row.muscle_group as MuscleGroup,
        equipment: row.equipment as Equipment | null,
        custom: true,
      })),
    ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const byId = new Map(all.map((exercise) => [exercise.id, exercise]));
    return { all, byId, loading: custom === undefined };
  }, [custom]);
}
