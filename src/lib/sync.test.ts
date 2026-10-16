import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the Supabase REST client: enough of the query
// builder for sync.ts, with the server's last-write-wins and
// server_updated_at triggers.
const server = vi.hoisted(() => {
  type Row = Record<string, unknown> & { id: string; user_id: string; updated_at: string };
  const tables = new Map<string, Map<string, Row & { server_updated_at: string }>>();
  let clock = Date.parse("2026-01-01T00:00:00Z");
  let failNext: string | null = null;
  const table = (name: string) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  };

  function from(name: string) {
    return {
      async upsert(rows: Row[]) {
        if (failNext) {
          const message = failNext;
          failNext = null;
          return { error: { message } };
        }
        for (const row of rows) {
          const stored = table(name).get(row.id);
          if (stored && Date.parse(row.updated_at) < Date.parse(stored.updated_at)) continue;
          table(name).set(row.id, { ...row, server_updated_at: new Date(++clock).toISOString() });
        }
        return { error: null };
      },
      select() {
        const filters: ((r: Row & { server_updated_at: string }) => boolean)[] = [];
        let limit = Infinity;
        const builder = {
          eq(col: string, value: unknown) {
            filters.push((r) => r[col] === value);
            return builder;
          },
          gt(col: string, value: string) {
            filters.push((r) => Date.parse(r[col] as string) > Date.parse(value));
            return builder;
          },
          order() {
            return builder;
          },
          limit(n: number) {
            limit = n;
            return builder;
          },
          then(resolve: (v: { data: unknown[]; error: null }) => void) {
            const data = [...table(name).values()]
              .filter((r) => filters.every((f) => f(r)))
              .sort((a, b) => a.server_updated_at.localeCompare(b.server_updated_at))
              .slice(0, limit)
              .map((r) => structuredClone(r));
            resolve({ data, error: null });
          },
        };
        return builder;
      },
    };
  }

  return {
    client: { from },
    tables,
    table,
    reset() {
      tables.clear();
      failNext = null;
    },
    failNextUpsert(message: string) {
      failNext = message;
    },
    /** Simulate another device writing directly to the server. */
    write(name: string, row: Row) {
      table(name).set(row.id, { ...row, server_updated_at: new Date(++clock).toISOString() });
    },
  };
});

vi.mock("./supabase", () => ({ supabase: server.client, LOCAL_USER_ID: "local" }));

const { db, newRowFields, touchedFields } = await import("./db");
const { fromServer, getSyncStatus, syncNow } = await import("./sync");

const USER = "user-1";

function routine(name: string, userId = USER) {
  return { ...newRowFields(userId), name, notes: null, position: 0 };
}

beforeEach(async () => {
  server.reset();
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("push", () => {
  it("uploads dirty rows without local fields and clears the flag", async () => {
    const r = routine("A");
    await db.routines.add(r);
    await syncNow(USER);

    const stored = server.table("routines").get(r.id)!;
    expect(stored.name).toBe("A");
    expect(stored).not.toHaveProperty("dirty");
    expect((await db.routines.get(r.id))?.dirty).toBe(0);
    expect(getSyncStatus().state).toBe("idle");
  });

  it("pushes parents before children", async () => {
    const order: string[] = [];
    const original = server.client.from;
    server.client.from = (name: string) => {
      const api = original(name);
      return { ...api, upsert: (rows: never[]) => (order.push(name), api.upsert(rows)) };
    };
    const r = routine("A");
    await db.routine_exercises.add({
      ...newRowFields(USER),
      routine_id: r.id,
      exercise_id: "flexao",
      position: 0,
      target_sets: 3,
      target_reps: "10",
      rest_seconds: 60,
      notes: null,
    });
    await db.routines.add(r);
    await syncNow(USER);
    server.client.from = original;
    expect(order).toEqual(["routines", "routine_exercises"]);
  });

  it("skips rows of other users", async () => {
    await db.routines.add(routine("mine"));
    await db.routines.add(routine("theirs", "user-2"));
    await syncNow(USER);
    expect([...server.table("routines").values()].map((r) => r.name)).toEqual(["mine"]);
  });

  it("keeps rows dirty and reports the error when the server rejects", async () => {
    const r = routine("A");
    await db.routines.add(r);
    server.failNextUpsert("new row violates row-level security policy");
    await syncNow(USER);
    expect(getSyncStatus()).toMatchObject({ state: "error" });
    expect((await db.routines.get(r.id))?.dirty).toBe(1);

    await syncNow(USER);
    expect((await db.routines.get(r.id))?.dirty).toBe(0);
  });
});

describe("pull", () => {
  it("downloads rows from other devices", async () => {
    const r = { ...routine("from phone"), dirty: undefined };
    delete r.dirty;
    server.write("routines", r);
    await syncNow(USER);
    expect(await db.routines.get(r.id)).toMatchObject({ name: "from phone", dirty: 0 });
  });

  it("keeps newer local edits over older server rows", async () => {
    const r = routine("A");
    await db.routines.add(r);
    await syncNow(USER);

    // Another device writes an older version; this device edits afterwards.
    server.write("routines", { ...server.table("routines").get(r.id)!, name: "server", updated_at: "2026-01-02T00:00:00.000Z" });
    await db.routines.update(r.id, { name: "local", ...touchedFields() });
    await syncNow(USER);

    expect((await db.routines.get(r.id))?.name).toBe("local");
    expect(server.table("routines").get(r.id)?.name).toBe("local");
  });

  it("applies a newer server version over a clean local row", async () => {
    const r = routine("A");
    await db.routines.add(r);
    await syncNow(USER);
    server.write("routines", {
      ...server.table("routines").get(r.id)!,
      name: "renamed elsewhere",
      updated_at: new Date(Date.now() + 60_000).toISOString(),
    });
    await syncNow(USER);
    expect((await db.routines.get(r.id))?.name).toBe("renamed elsewhere");
  });

  it("pages through large tables and stores a cursor", async () => {
    for (let i = 0; i < 1203; i++) {
      const r = routine(`r${i}`);
      delete (r as Partial<typeof r>).dirty;
      server.write("routines", r);
    }
    await syncNow(USER);
    expect(await db.routines.count()).toBe(1203);
    expect((await db.meta.get("cursor:routines"))?.value).toBeTruthy();
  });

  it("does not rewrite unchanged rows on the next cycle", async () => {
    await db.routines.add(routine("A"));
    await syncNow(USER);
    const spy = vi.spyOn(db.routines, "put");
    await syncNow(USER);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("fromServer", () => {
  it("normalizes timestamps and numbers and drops server columns", () => {
    expect(
      fromServer({
        id: "x",
        updated_at: "2026-01-01T10:00:00.123456+00:00",
        weight_kg: "62.50",
        reps: 8,
        deleted_at: null,
        server_updated_at: "2026-01-01T10:00:01+00:00",
      }),
    ).toEqual({ id: "x", updated_at: "2026-01-01T10:00:00.123Z", weight_kg: 62.5, reps: 8, deleted_at: null, dirty: 0 });
  });
});

describe("offline", () => {
  it("does nothing and reports offline when the browser is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await db.routines.add(routine("A"));
    await syncNow(USER);
    expect(getSyncStatus().state).toBe("offline");
    expect(server.table("routines").size).toBe(0);
    vi.unstubAllGlobals();
  });
});
