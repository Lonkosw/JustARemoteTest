import { describe, expect, it } from "vitest";
import { CATALOG, EQUIPMENT, MUSCLE_GROUPS, normalize } from "./exercises";
import { TEMPLATES } from "./templates";
import { parseRepRange } from "./workouts";

describe("exercise catalog", () => {
  it("has unique, slug-shaped ids", () => {
    const ids = CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("has unique names", () => {
    const names = CATALOG.map((e) => normalize(e.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses known groups and equipment, and covers every group", () => {
    for (const e of CATALOG) {
      expect(MUSCLE_GROUPS).toHaveProperty(e.muscle_group);
      if (e.equipment) expect(EQUIPMENT).toHaveProperty(e.equipment);
    }
    expect(new Set(CATALOG.map((e) => e.muscle_group)).size).toBe(Object.keys(MUSCLE_GROUPS).length);
  });

  it("has around 150 exercises", () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(150);
  });
});

describe("templates", () => {
  it("only reference catalog exercises and sane targets", () => {
    const ids = new Set(CATALOG.map((e) => e.id));
    for (const template of TEMPLATES) {
      expect(template.routines.length).toBeGreaterThan(0);
      for (const routine of template.routines) {
        expect(routine.exercises.length).toBeGreaterThanOrEqual(5);
        for (const [id, sets, reps, rest] of routine.exercises) {
          expect(ids.has(id), `${template.id}/${routine.name}: ${id}`).toBe(true);
          expect(sets).toBeGreaterThanOrEqual(1);
          expect(rest).toBeGreaterThan(0);
          // Rep targets are numeric ranges, or timed holds ending in "s".
          expect(parseRepRange(reps) !== null || /s$/.test(reps), reps).toBe(true);
        }
      }
    }
  });

  it("have unique ids and routine names", () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) {
      expect(new Set(t.routines.map((r) => r.name)).size).toBe(t.routines.length);
    }
  });
});

describe("normalize", () => {
  it("lowercases and strips accents", () => {
    expect(normalize("Elevação Pélvica")).toBe("elevacao pelvica");
  });
});
