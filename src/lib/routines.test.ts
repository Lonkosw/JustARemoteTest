import { beforeEach, describe, expect, it } from "vitest";
import { db, hasUnsyncedChanges } from "./db";
import {
  addExercisesToRoutine,
  applyTemplate,
  createCustomExercise,
  createRoutine,
  deleteRoutine,
  listRoutineExercises,
  listRoutines,
  moveRoutine,
  moveRoutineExercise,
  removeRoutineExercise,
  updateRoutineExercise,
} from "./routines";
import { TEMPLATES } from "./templates";

const USER = "u1";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("routines", () => {
  it("creates routines at the end, marked dirty", async () => {
    await createRoutine(USER, "A");
    await createRoutine(USER, "B");
    const list = await listRoutines(USER);
    expect(list.map((r) => [r.name, r.position, r.dirty])).toEqual([
      ["A", 0, 1],
      ["B", 1, 1],
    ]);
    expect(await hasUnsyncedChanges()).toBe(true);
  });

  it("applies a template as editable routines", async () => {
    const ppl = TEMPLATES.find((t) => t.id === "ppl")!;
    const ids = await applyTemplate(USER, ppl);
    expect(ids).toHaveLength(3);
    const items = await listRoutineExercises(ids[0]);
    expect(items.map((i) => i.exercise_id)).toEqual(ppl.routines[0].exercises.map(([id]) => id));
    expect(items[0]).toMatchObject({ target_sets: 4, target_reps: "6-8", rest_seconds: 150, position: 0 });
  });

  it("reorders and renumbers", async () => {
    const a = await createRoutine(USER, "A");
    await createRoutine(USER, "B");
    const c = await createRoutine(USER, "C");
    await moveRoutine(USER, c, -1);
    expect((await listRoutines(USER)).map((r) => r.name)).toEqual(["A", "C", "B"]);
    await moveRoutine(USER, a, -1); // already first: no-op
    expect((await listRoutines(USER)).map((r) => r.name)).toEqual(["A", "C", "B"]);
  });

  it("heals repeated positions when moving", async () => {
    const a = await createRoutine(USER, "A");
    const b = await createRoutine(USER, "B");
    await db.routines.update(b, { position: 0 }); // both at 0, e.g. after a merge
    await moveRoutine(USER, a, 1);
    const positions = (await listRoutines(USER)).map((r) => r.position);
    expect(new Set(positions).size).toBe(2);
  });

  it("soft deletes a routine with its exercises", async () => {
    const id = await createRoutine(USER, "A");
    await addExercisesToRoutine(USER, id, ["flexao", "prancha"]);
    await deleteRoutine(id);
    expect(await listRoutines(USER)).toHaveLength(0);
    expect(await listRoutineExercises(id)).toHaveLength(0);
    expect((await db.routine_exercises.toArray()).every((r) => r.deleted_at && r.dirty === 1)).toBe(true);
  });

  it("edits, moves and removes exercises", async () => {
    const id = await createRoutine(USER, "A");
    await addExercisesToRoutine(USER, id, ["flexao", "prancha", "burpee"]);
    let items = await listRoutineExercises(id);
    await updateRoutineExercise(items[0].id, { target_sets: 5, target_reps: "15", rest_seconds: 45 });
    await moveRoutineExercise(id, items[2].id, -1);
    await removeRoutineExercise(items[1].id);
    items = await listRoutineExercises(id);
    expect(items.map((i) => i.exercise_id)).toEqual(["flexao", "burpee"]);
    expect(items[0]).toMatchObject({ target_sets: 5, target_reps: "15", rest_seconds: 45 });
  });

  it("creates custom exercises", async () => {
    const id = await createCustomExercise(USER, { name: "Supino com corrente", muscle_group: "chest", equipment: null });
    expect(await db.custom_exercises.get(id)).toMatchObject({ name: "Supino com corrente", user_id: USER, dirty: 1 });
  });
});
