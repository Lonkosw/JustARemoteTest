import { db } from "./db";
import { supabase } from "./supabase";
import type { Profile } from "./types";

/**
 * Push the local profile to Supabase if it has unsynced changes. Fails
 * quietly when offline: the row stays dirty and the next call retries.
 *
 * Temporary until the generic sync engine (stage 3) covers every table.
 */
export async function pushProfile(userId: string): Promise<void> {
  if (!supabase) return;
  const profile = await db.profiles.get(userId);
  if (!profile || profile.dirty === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { dirty, ...row } = profile;
  const { error } = await supabase.from("profiles").upsert(row);
  if (error) return;

  // Clear the flag only if nothing changed while the request ran.
  await db.profiles
    .where("id")
    .equals(userId)
    .and((p) => p.updated_at === profile.updated_at)
    .modify({ dirty: 0 });
}

/**
 * Copy the profile from Supabase into IndexedDB when this device has none,
 * for example after signing in on a new phone. Returns true if one was found.
 */
export async function pullProfileIfMissing(userId: string): Promise<boolean> {
  if (!supabase) return false;
  if (await db.profiles.get(userId)) return true;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, name, sex, birth_year, height_cm, goal, level, days_per_week, created_at, updated_at, deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;

  const profile: Profile = {
    ...data,
    height_cm: data.height_cm === null ? null : Number(data.height_cm),
    dirty: 0,
  };
  await db.profiles.put(profile);
  return true;
}
