import { beforeEach, describe, expect, it } from "vitest";
import {
  bmi,
  deleteMeasurement,
  hasAnyValue,
  latestWithChange,
  listMeasurements,
  saveMeasurement,
  series,
  valueNear,
  type MeasurementValues,
} from "./body";
import { db } from "./db";
import type { BodyMeasurement } from "./types";

const USER = "u1";

function values(overrides: Partial<MeasurementValues>): MeasurementValues {
  return {
    measured_on: "2026-01-01",
    notes: null,
    weight_kg: null,
    body_fat_pct: null,
    waist_cm: null,
    chest_cm: null,
    hips_cm: null,
    arm_cm: null,
    thigh_cm: null,
    calf_cm: null,
    ...overrides,
  };
}

const row = (measured_on: string, v: Partial<MeasurementValues>) =>
  ({ ...values({ measured_on, ...v }), id: measured_on, created_at: measured_on }) as BodyMeasurement;

describe("calculations", () => {
  const rows = [
    row("2026-01-01", { weight_kg: 82 }),
    row("2026-01-20", { weight_kg: 81, waist_cm: 90 }),
    row("2026-02-05", { waist_cm: 88 }),
    row("2026-02-10", { weight_kg: 79.4 }),
  ];

  it("builds series skipping empty values", () => {
    expect(series(rows, "waist_cm")).toEqual([
      { date: "2026-01-20", value: 90 },
      { date: "2026-02-05", value: 88 },
    ]);
  });

  it("gives the latest value and the change over 30 days", () => {
    // Latest 10 Feb; the newest entry on or before 11 Jan is 1 Jan (82).
    expect(latestWithChange(rows, "weight_kg")).toEqual({ value: 79.4, date: "2026-02-10", change: -2.6 });
    // Waist history is shorter than 30 days.
    expect(latestWithChange(rows, "waist_cm")?.change).toBeNull();
    expect(latestWithChange(rows, "arm_cm")).toBeNull();
  });

  it("computes BMI", () => {
    expect(bmi(80, 180)).toBe(24.7);
    expect(bmi(null, 180)).toBeNull();
    expect(bmi(80, null)).toBeNull();
  });

  it("finds the value nearest a date within a window", () => {
    expect(valueNear(rows, "weight_kg", "2026-01-22")).toBe(81);
    expect(valueNear(rows, "weight_kg", "2026-03-30")).toBeNull();
  });

  it("detects empty entries", () => {
    expect(hasAnyValue(values({}))).toBe(false);
    expect(hasAnyValue(values({ calf_cm: 38 }))).toBe(true);
  });
});

describe("storage", () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it("saves, edits, orders and deletes entries", async () => {
    const late = await saveMeasurement(USER, values({ measured_on: "2026-02-01", weight_kg: 80 }));
    await saveMeasurement(USER, values({ measured_on: "2026-01-01", weight_kg: 82 }));
    expect((await listMeasurements(USER)).map((m) => m.weight_kg)).toEqual([82, 80]);

    await saveMeasurement(USER, values({ measured_on: "2026-02-01", weight_kg: 79.5, waist_cm: 85 }), late);
    const edited = await db.body_measurements.get(late);
    expect(edited).toMatchObject({ weight_kg: 79.5, waist_cm: 85, dirty: 1 });

    await deleteMeasurement(late);
    expect(await listMeasurements(USER)).toHaveLength(1);
  });
});
