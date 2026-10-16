import { db, newRowFields, touchedFields } from "./db";
import type { BodyMeasurement } from "./types";

// Body measurements: weight, body fat and circumferences, one row per entry.

export const MEASUREMENT_FIELDS = [
  { key: "weight_kg", label: "Peso", unit: "kg" },
  { key: "body_fat_pct", label: "Gordura corporal", unit: "%" },
  { key: "waist_cm", label: "Cintura", unit: "cm" },
  { key: "chest_cm", label: "Peito", unit: "cm" },
  { key: "hips_cm", label: "Quadril", unit: "cm" },
  { key: "arm_cm", label: "Braço", unit: "cm" },
  { key: "thigh_cm", label: "Coxa", unit: "cm" },
  { key: "calf_cm", label: "Panturrilha", unit: "cm" },
] as const;

export type MeasurementKey = (typeof MEASUREMENT_FIELDS)[number]["key"];
export type MeasurementValues = Record<MeasurementKey, number | null> & { measured_on: string; notes: string | null };

/** Entries oldest first. Same-day entries keep their creation order. */
export async function listMeasurements(userId: string): Promise<BodyMeasurement[]> {
  const rows = await db.body_measurements
    .where("user_id")
    .equals(userId)
    .filter((m) => !m.deleted_at)
    .toArray();
  return rows.sort((a, b) => a.measured_on.localeCompare(b.measured_on) || a.created_at.localeCompare(b.created_at));
}

export async function saveMeasurement(userId: string, values: MeasurementValues, id?: string): Promise<string> {
  if (id) {
    await db.body_measurements.update(id, { ...values, ...touchedFields() });
    return id;
  }
  const row: BodyMeasurement = { ...newRowFields(userId), ...values };
  await db.body_measurements.add(row);
  return row.id;
}

export async function deleteMeasurement(id: string) {
  await db.body_measurements.update(id, { deleted_at: new Date().toISOString(), ...touchedFields() });
}

/** True when at least one measurement has a value. */
export function hasAnyValue(values: Partial<Record<MeasurementKey, number | null>>): boolean {
  return MEASUREMENT_FIELDS.some(({ key }) => values[key] !== null && values[key] !== undefined);
}

/** Points of one field over time, skipping entries without it. */
export function series(rows: BodyMeasurement[], key: MeasurementKey): { date: string; value: number }[] {
  return rows.flatMap((r) => (r[key] === null ? [] : [{ date: r.measured_on, value: r[key] as number }]));
}

/**
 * Latest value and the change against the latest value at least `days`
 * before it. Null change when there is no entry that old.
 */
export function latestWithChange(
  rows: BodyMeasurement[],
  key: MeasurementKey,
  days = 30,
): { value: number; date: string; change: number | null } | null {
  const points = series(rows, key);
  const last = points.at(-1);
  if (!last) return null;
  const cutoff = shiftDate(last.date, -days);
  const base = [...points].reverse().find((p) => p.date <= cutoff);
  return { value: last.value, date: last.date, change: base ? round(last.value - base.value) : null };
}

/** Body mass index, rounded to one decimal. */
export function bmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm) return null;
  return round(weightKg / (heightCm / 100) ** 2);
}

/** Value of `key` on the entry closest to `date` (within `maxDays`). */
export function valueNear(
  rows: BodyMeasurement[],
  key: MeasurementKey,
  date: string,
  maxDays = 7,
): number | null {
  let best: { distance: number; value: number } | null = null;
  for (const p of series(rows, key)) {
    const distance = Math.abs(Date.parse(p.date) - Date.parse(date)) / 86_400_000;
    if (distance <= maxDays && (!best || distance < best.distance)) best = { distance, value: p.value };
  }
  return best?.value ?? null;
}

/** Today as YYYY-MM-DD in local time. */
export function today(): string {
  return new Date().toLocaleDateString("sv-SE");
}

function shiftDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d + days).toLocaleDateString("sv-SE");
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
