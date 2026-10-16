import Dexie from "dexie";
import { db, SYNCED_TABLES, type SyncedTable } from "./db";
import { supabase } from "./supabase";

// Two-way sync between IndexedDB and Supabase.
//
// Push: rows with dirty = 1 are upserted, parents before children. The
// server ignores an update older than the stored row (keep_newest_write).
// Pull: rows with server_updated_at after the per-table cursor are copied
// down, unless the local copy has newer unsynced changes.

const PUSH_BATCH = 200;
const PULL_PAGE = 500;
// Re-read a short window before the cursor: a transaction that started
// earlier can commit after a later one.
const PULL_OVERLAP_MS = 60_000;

const NUMERIC_FIELDS = new Set([
  "height_cm",
  "weight_kg",
  "rpe",
  "body_fat_pct",
  "chest_cm",
  "waist_cm",
  "hips_cm",
  "arm_cm",
  "thigh_cm",
  "calf_cm",
]);

export type SyncStatus = {
  state: "idle" | "syncing" | "error" | "offline";
  lastSyncAt: string | null;
  error: string | null;
};

let status: SyncStatus = { state: "idle", lastSyncAt: null, error: null };
const listeners = new Set<() => void>();

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  listeners.forEach((listener) => listener());
}

export function getSyncStatus() {
  return status;
}

export function subscribeSyncStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let running: Promise<void> | null = null;
let again = false;

/**
 * Run one push + pull cycle. Calls made while a cycle runs are coalesced
 * into one follow-up cycle. Never throws; the outcome lands in the status.
 */
export function syncNow(userId: string): Promise<void> {
  if (!supabase) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runCycle(userId);
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function runCycle(userId: string) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setStatus({ state: "offline" });
    return;
  }
  setStatus({ state: "syncing", error: null });
  try {
    for (const table of SYNCED_TABLES) await push(table, userId);
    for (const table of SYNCED_TABLES) await pull(table, userId);
    setStatus({ state: "idle", lastSyncAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const offline = message.includes("Failed to fetch") || message.includes("NetworkError");
    setStatus({ state: offline ? "offline" : "error", error: offline ? null : message });
  }
}

async function push(name: SyncedTable, userId: string) {
  const table = db.table(name);
  const dirty = await table.where("dirty").equals(1).toArray();
  const mine = dirty.filter((row) => row.user_id === userId);

  for (let i = 0; i < mine.length; i += PUSH_BATCH) {
    const batch = mine.slice(i, i + PUSH_BATCH);
    const payload = batch.map((row) => {
      const copy = { ...row };
      delete copy.dirty;
      delete copy.server_updated_at;
      return copy;
    });
    const { error } = await supabase!.from(name).upsert(payload);
    if (error) throw new Error(`${name}: ${error.message}`);

    // Clear the flag only on rows not edited while the request ran.
    await db.transaction("rw", table, async () => {
      for (const row of batch) {
        await table
          .where("id")
          .equals(row.id)
          .and((current) => current.updated_at === row.updated_at)
          .modify({ dirty: 0 });
      }
    });
  }
}

async function pull(name: SyncedTable, userId: string) {
  const table = db.table(name);
  const cursorKey = `cursor:${name}`;
  const cursor = (await db.meta.get(cursorKey))?.value as string | undefined;
  let since = cursor ? new Date(Date.parse(cursor) - PULL_OVERLAP_MS).toISOString() : "1970-01-01T00:00:00Z";
  let newest = cursor ?? null;

  for (;;) {
    const { data, error } = await supabase!
      .from(name)
      .select("*")
      .eq("user_id", userId)
      .gt("server_updated_at", since)
      .order("server_updated_at")
      .limit(PULL_PAGE);
    if (error) throw new Error(`${name}: ${error.message}`);
    if (!data.length) break;

    await db.transaction("rw", table, async () => {
      for (const remote of data) {
        const row = fromServer(remote);
        const local = await table.get(row.id);
        if (local?.dirty === 1 && Date.parse(local.updated_at) > Date.parse(row.updated_at)) continue;
        // Skip rows already stored: rewriting them would fire a change event
        // and start another sync (the overlap window re-reads rows).
        if (local?.dirty === 0 && Date.parse(local.updated_at) === Date.parse(row.updated_at)) continue;
        await table.put(row);
      }
    });

    const last = data[data.length - 1].server_updated_at as string;
    if (!newest || Date.parse(last) > Date.parse(newest)) newest = last;
    if (data.length < PULL_PAGE) break;
    since = last;
  }

  if (newest && newest !== cursor) await db.meta.put({ key: cursorKey, value: newest });
}

/** Server row to local shape: ISO timestamps, numbers, no server columns. */
export function fromServer(remote: Record<string, unknown>) {
  const row: Record<string, unknown> = { dirty: 0 };
  for (const [key, value] of Object.entries(remote)) {
    if (key === "server_updated_at") continue;
    if (value !== null && key.endsWith("_at")) row[key] = new Date(value as string).toISOString();
    else if (value !== null && NUMERIC_FIELDS.has(key)) row[key] = Number(value);
    else row[key] = value;
  }
  return row as { id: string; updated_at: string };
}

/**
 * Calls `onChange` after local writes to synced tables, debounced. Writes to
 * the meta table (sync cursors) are ignored so a sync does not retrigger
 * itself forever.
 */
export function watchLocalChanges(onChange: () => void, delayMs = 2000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pattern = new RegExp(`^idb://${db.name}/(${SYNCED_TABLES.join("|")})/`);
  const handler = (parts: Record<string, unknown>) => {
    if (!Object.keys(parts).some((key) => pattern.test(key))) return;
    clearTimeout(timer);
    timer = setTimeout(onChange, delayMs);
  };
  Dexie.on("storagemutated", handler);
  return () => {
    clearTimeout(timer);
    Dexie.on.storagemutated.unsubscribe(handler);
  };
}
