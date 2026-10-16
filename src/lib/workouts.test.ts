import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { applyTemplate } from "./routines";
import { TEMPLATES } from "./templates";
import type { WorkoutSet } from "./types";
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
  startWorkout,
  suggestNext,
  updateSet,
  workoutVolume,
} from "./workouts";

const USER = "u1";

const prev = (weight_kg: number | null, reps: number | null) => ({ weight_kg, reps }) as WorkoutSet;

describe("parseRepRange", () => {
  it.each([
    ["8-12", [8, 12]],
    ["10", [10, 10]],
    ["12 - 8", [8, 12]],
    ["6–8", [6, 8]],
    ["8 a 10", [8, 10]],
  ])("parses %s", (input, expected) => {
    expect(parseRepRange(input)).toEqual(expected);
  });

  it.each(["30-45s", "", "max", null])("rejects %s", (input) => {
    expect(parseRepRange(input)).toBeNull();
  });
});

describe("suggestNext", () => {
  it("adds load when every set hit the top of the range", () => {
    expect(suggestNext([prev(60, 10), prev(60, 10)], [8, 10], "barbell")).toEqual({
      weight_kg: 62.5,
      reps: 8,
      progressed: true,
    });
    expect(suggestNext([prev(20, 12)], [10, 12], "dumbbell")?.weight_kg).toBe(22);
  });

  it("repeats the last set when the top was missed", () => {
    expect(suggestNext([prev(60, 10), prev(60, 8)], [8, 10], "barbell")).toEqual({
      weight_kg: 60,
      reps: 8,
      progressed: false,
    });
  });

  it("adds a rep for bodyweight exercises", () => {
    expect(suggestNext([prev(null, 12), prev(null, 12)], [8, 12], "bodyweight")).toEqual({
      weight_kg: null,
      reps: 13,
      progressed: true,
    });
  });

  it("does not progress without a numeric target", () => {
    expect(suggestNext([prev(60, 10)], null, "barbell")?.progressed).toBe(false);
  });

  it("returns null without history", () => {
    expect(suggestNext([], [8, 10], "barbell")).toBeNull();
  });
});

describe("formatting", () => {
  it("formats kg in pt-BR", () => {
    expect(formatKg(62.5)).toBe("62,5");
    expect(formatKg(1000)).toBe("1.000");
    expect(formatKg(null)).toBe("—");
  });
  it("formats durations", () => {
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
    expect(formatDuration(-5)).toBe("0:00");
  });
});

describe("workout lifecycle (IndexedDB)", () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  async function routineA() {
    const [id] = await applyTemplate(USER, TEMPLATES.find((t) => t.id === "abc")!);
    return id;
  }

  it("starts from a routine with the planned sets", async () => {
    const workoutId = await startWorkout(USER, await routineA());
    const sets = await listWorkoutSets(workoutId);
    expect(sets).toHaveLength(22); // 4 + 3 * 6
    expect(new Set(sets.map((s) => s.exercise_position)).size).toBe(7);
    expect((await getActiveWorkout(USER))?.id).toBe(workoutId);
  });

  it("finishes by dropping incomplete sets", async () => {
    const workoutId = await startWorkout(USER, await routineA());
    const [first] = (await listWorkoutSets(workoutId)).sort((a, b) => a.exercise_position - b.exercise_position);
    await updateSet(first.id, { weight_kg: 60, reps: 10, completed_at: new Date().toISOString() });
    await finishWorkout(workoutId);

    const remaining = await listWorkoutSets(workoutId);
    expect(remaining).toHaveLength(1);
    expect(workoutVolume(remaining)).toBe(600);
    expect(await getActiveWorkout(USER)).toBeNull();
    expect((await db.workouts.get(workoutId))?.dirty).toBe(1);
  });

  it("discards everything", async () => {
    const workoutId = await startWorkout(USER, null);
    await addExercisesToWorkout(USER, workoutId, ["agachamento-livre"]);
    await discardWorkout(workoutId);
    expect(await listWorkoutSets(workoutId)).toHaveLength(0);
    expect((await db.workouts.get(workoutId))?.deleted_at).not.toBeNull();
  });

  it("adds exercises and sets in order", async () => {
    const workoutId = await startWorkout(USER, null);
    await addExercisesToWorkout(USER, workoutId, ["agachamento-livre", "leg-press-45"]);
    await addSet(USER, workoutId, "agachamento-livre", 0);
    const sets = await listWorkoutSets(workoutId);
    expect(sets.filter((s) => s.exercise_position === 0).map((s) => s.set_index).sort()).toEqual([0, 1, 2, 3]);
    expect(sets.filter((s) => s.exercise_position === 1)).toHaveLength(3);
  });

  it("finds the previous session's working sets", async () => {
    const first = await startWorkout(USER, null);
    await addExercisesToWorkout(USER, first, ["agachamento-livre"]);
    const sets = (await listWorkoutSets(first)).sort((a, b) => a.set_index - b.set_index);
    await updateSet(sets[0].id, { weight_kg: 40, reps: 10, is_warmup: true, completed_at: "2026-01-01T10:00:00Z" });
    await updateSet(sets[1].id, { weight_kg: 100, reps: 5, completed_at: "2026-01-01T10:05:00Z" });
    await updateSet(sets[2].id, { weight_kg: 100, reps: 4, completed_at: "2026-01-01T10:10:00Z" });
    await finishWorkout(first);

    const second = await startWorkout(USER, null);
    const previous = await getPreviousSets(USER, "agachamento-livre", second);
    expect(previous.map((s) => [s.weight_kg, s.reps])).toEqual([
      [100, 5],
      [100, 4],
    ]);
  });
});
