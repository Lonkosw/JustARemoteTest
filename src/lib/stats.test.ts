import { describe, expect, it } from "vitest";
import {
  estimate1rm,
  recordsBeaten,
  recordsInWorkout,
  recordsOf,
  sessionsOf,
  setsPerMuscleGroup,
  startOfWeek,
  type LoggedSet,
} from "./stats";
import type { WorkoutSet } from "./types";

let seq = 0;
function set(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  seq++;
  return {
    id: `s${seq}`,
    user_id: "u",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    dirty: 0,
    workout_id: "w1",
    exercise_id: "supino-reto-barra",
    exercise_position: 0,
    set_index: 0,
    weight_kg: 60,
    reps: 10,
    rpe: null,
    is_warmup: false,
    completed_at: `2026-01-01T10:00:${String(seq % 60).padStart(2, "0")}.000Z`,
    ...overrides,
  };
}

describe("estimate1rm", () => {
  it("uses Epley", () => {
    expect(estimate1rm(100, 10)).toBeCloseTo(133.33, 2);
    expect(estimate1rm(60, 5)).toBeCloseTo(70);
  });
  it("returns the weight itself for a single", () => {
    expect(estimate1rm(140, 1)).toBe(140);
  });
  it("is null without load or outside 1-15 reps", () => {
    expect(estimate1rm(null, 10)).toBeNull();
    expect(estimate1rm(0, 10)).toBeNull();
    expect(estimate1rm(50, 0)).toBeNull();
    expect(estimate1rm(50, 16)).toBeNull();
  });
});

describe("recordsOf / recordsBeaten", () => {
  const history = [set({ weight_kg: 60, reps: 10 }), set({ weight_kg: 70, reps: 3 })];

  it("finds best e1RM and heaviest load", () => {
    const r = recordsOf(history);
    expect(r.e1rm).toBeCloseTo(80); // 60 x 10
    expect(r.weight).toBe(70);
    expect(r.reps).toBeNull();
  });

  it("tracks reps only for sets without load", () => {
    expect(recordsOf([set({ weight_kg: null, reps: 12 }), set({ weight_kg: null, reps: 15 })]).reps).toBe(15);
  });

  it("detects each record kind", () => {
    const baseline = recordsOf(history);
    expect(recordsBeaten({ weight_kg: 72.5, reps: 1 }, baseline)).toEqual(["weight"]);
    expect(recordsBeaten({ weight_kg: 62.5, reps: 10 }, baseline)).toEqual(["e1rm"]);
    expect(recordsBeaten({ weight_kg: 75, reps: 5 }, baseline)).toEqual(["e1rm", "weight"]);
    expect(recordsBeaten({ weight_kg: 60, reps: 10 }, baseline)).toEqual([]);
    expect(recordsBeaten({ weight_kg: null, reps: 16 }, recordsOf([set({ weight_kg: null, reps: 15 })]))).toEqual([
      "reps",
    ]);
  });

  it("never awards a record without a baseline", () => {
    expect(recordsBeaten({ weight_kg: 100, reps: 5 }, recordsOf([]))).toEqual([]);
  });
});

describe("recordsInWorkout", () => {
  it("awards only the first set that beats the record", () => {
    const earlier = [set({ workout_id: "old", weight_kg: 60, reps: 10 })];
    const a = set({ workout_id: "new", weight_kg: 65, reps: 10, completed_at: "2026-02-01T10:00:00.000Z" });
    const b = set({ workout_id: "new", weight_kg: 65, reps: 10, completed_at: "2026-02-01T10:03:00.000Z" });
    const c = set({ workout_id: "new", weight_kg: 67.5, reps: 8, completed_at: "2026-02-01T10:06:00.000Z" });
    const result = recordsInWorkout([c, b, a], earlier);
    expect(result.get(a.id)).toEqual(["e1rm", "weight"]);
    expect(result.has(b.id)).toBe(false);
    // 67.5 x 8 is heavier than 65, but its e1RM (85.5) is below 65 x 10 (86.7).
    expect(result.get(c.id)).toEqual(["weight"]);
  });

  it("gives no records on the first session of an exercise", () => {
    const a = set({ workout_id: "new", weight_kg: 40, reps: 10, completed_at: "2026-02-01T10:00:00.000Z" });
    const b = set({ workout_id: "new", weight_kg: 50, reps: 10, completed_at: "2026-02-01T10:03:00.000Z" });
    expect(recordsInWorkout([a, b], []).size).toBe(0);
  });

  it("ignores warm-ups and incomplete sets", () => {
    const earlier = [set({ workout_id: "old", weight_kg: 60, reps: 10 })];
    const warm = set({ workout_id: "new", weight_kg: 100, reps: 5, is_warmup: true });
    const open = set({ workout_id: "new", weight_kg: 100, reps: 5, completed_at: null });
    expect(recordsInWorkout([warm, open], earlier).size).toBe(0);
  });
});

describe("sessionsOf", () => {
  it("groups by workout, oldest first, with summary numbers", () => {
    const logged = (o: Partial<WorkoutSet>, date: string): LoggedSet => ({ ...set(o), workout_started_at: date });
    const sessions = sessionsOf([
      logged({ workout_id: "b", set_index: 1, weight_kg: 62.5, reps: 8 }, "2026-02-08T10:00:00.000Z"),
      logged({ workout_id: "a", set_index: 0, weight_kg: 60, reps: 10 }, "2026-02-01T10:00:00.000Z"),
      logged({ workout_id: "b", set_index: 0, weight_kg: 62.5, reps: 9 }, "2026-02-08T10:00:00.000Z"),
    ]);
    expect(sessions.map((s) => s.workoutId)).toEqual(["a", "b"]);
    expect(sessions[1].sets.map((s) => s.reps)).toEqual([9, 8]);
    expect(sessions[1].maxWeight).toBe(62.5);
    expect(sessions[1].maxReps).toBe(9);
    expect(sessions[1].volume).toBe(62.5 * 17);
    expect(sessions[1].bestE1rm).toBeCloseTo(62.5 * (1 + 9 / 30));
  });
});

describe("setsPerMuscleGroup / startOfWeek", () => {
  it("counts recent sets per group", () => {
    const groups: Record<string, "chest" | "back"> = { a: "chest", b: "back" };
    const counts = setsPerMuscleGroup(
      [
        { exercise_id: "a", completed_at: "2026-03-10T10:00:00Z" },
        { exercise_id: "a", completed_at: "2026-03-11T10:00:00Z" },
        { exercise_id: "b", completed_at: "2026-03-01T10:00:00Z" },
        { exercise_id: "unknown", completed_at: "2026-03-11T10:00:00Z" },
      ],
      (id) => groups[id],
      new Date("2026-03-05T00:00:00Z"),
    );
    expect([...counts]).toEqual([["chest", 2]]);
  });

  it("starts weeks on Monday", () => {
    const monday = startOfWeek(new Date(2026, 9, 18)); // Sunday 18 Oct 2026
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(12);
    expect(startOfWeek(new Date(2026, 9, 12, 15)).getDate()).toBe(12);
  });
});
