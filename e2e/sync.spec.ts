import { execFileSync } from "node:child_process";
import { expect, test, type Browser } from "@playwright/test";
import { signAccessToken } from "../scripts/test-backend/jwt.mjs";
import { acceptDialogs, applyTemplate, exerciseBlock, logSet, onboard, routineCard, startRoutine } from "./helpers";

// Runs against the local test backend (scripts/test-backend/start.sh) with
// the app built to point at it. Each "device" is a separate browser context
// holding a Supabase session for the same user.

const BACKEND = "http://127.0.0.1:54321";
const USER_1 = "11111111-1111-1111-1111-111111111111";
const USER_2 = "22222222-2222-2222-2222-222222222222";

test.describe.configure({ mode: "serial" });

function sql(query: string): string {
  return execFileSync("psql", ["-h", "127.0.0.1", "-p", process.env.PG_PORT ?? "5499", "-U", "postgres", "-tAc", query])
    .toString()
    .trim();
}

async function device(browser: Browser, userId: string) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, ...test.info().project.use });
  const session = {
    access_token: signAccessToken(userId),
    refresh_token: "unused",
    token_type: "bearer",
    expires_in: 60 * 60 * 24 * 365,
    expires_at: 4102444800,
    user: { id: userId, aud: "authenticated", role: "authenticated", email: `${userId.slice(0, 8)}@test.local` },
  };
  // supabase-js keeps the session under sb-<host>-auth-token.
  await context.addInitScript((s) => localStorage.setItem("sb-127-auth-token", JSON.stringify(s)), session);
  const page = await context.newPage();
  acceptDialogs(page);
  return { context, page };
}

test.beforeAll(() => {
  sql("truncate profiles, custom_exercises, routines, routine_exercises, workouts, workout_sets, body_measurements, progress_photos cascade");
});

test("two devices of one user stay in sync", async ({ browser }) => {
  // Device A: onboarding, template and a workout.
  const a = await device(browser, USER_1);
  await onboard(a.page, { name: "Theo Sync", height: "178", weight: "80,5" });
  await applyTemplate(a.page, "ABC", 3);
  await startRoutine(a.page, "A — Peito");
  const supino = exerciseBlock(a.page, "Supino reto com barra");
  await logSet(supino, 1, "60", "10");
  await logSet(supino, 2, "60", "10");
  await a.page.getByRole("button", { name: "Finalizar" }).click();
  await a.page.waitForURL("**/treino/resumo?id=*");

  await expect.poll(() => sql("select count(*) from routines"), { timeout: 20_000 }).toBe("3");
  await expect.poll(() => sql("select count(*) from workouts where finished_at is not null")).toBe("1");
  await expect
    .poll(() => sql("select count(*) from workout_sets where deleted_at is null and completed_at is not null"))
    .toBe("2");
  expect(sql("select name || ',' || height_cm from profiles")).toBe("Theo Sync,178.0");
  expect(sql("select weight_kg from body_measurements")).toBe("80.50");

  // Device B: fresh install pulls everything and skips onboarding.
  const b = await device(browser, USER_1);
  await b.page.goto("/");
  await expect(b.page.getByRole("heading", { name: "Theo" })).toBeVisible({ timeout: 20_000 });
  await expect(routineCard(b.page, "B — Costas").getByText("Próximo da sequência")).toBeVisible();
  await startRoutine(b.page, "A — Peito");
  await expect(exerciseBlock(b.page, "Supino reto com barra")).toContainText("60 × 10");
  await b.page.getByRole("button", { name: "Descartar treino" }).click();
  await b.page.waitForURL((url) => url.pathname === "/");

  // An edit on B reaches A.
  await b.page.goto("/fichas");
  await b.page.getByText("C — Pernas").click();
  await b.page.getByLabel("Nome da ficha").fill("C — Leg day");
  await b.page.getByLabel("Nome da ficha").press("Enter");
  await expect.poll(() => sql("select count(*) from routines where name = 'C — Leg day'"), { timeout: 20_000 }).toBe("1");
  await a.page.goto("/fichas");
  await expect(a.page.getByText("C — Leg day")).toBeVisible({ timeout: 20_000 });

  // Offline edits on A are pushed once the network returns.
  await a.context.setOffline(true);
  await a.page.getByText("B — Costas e bíceps").click();
  await a.page.getByLabel("Nome da ficha").fill("B — Pull offline");
  await a.page.getByLabel("Nome da ficha").press("Enter");
  await a.page.waitForTimeout(3_000);
  expect(sql("select count(*) from routines where name = 'B — Pull offline'")).toBe("0");
  await a.context.setOffline(false);
  await a.page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect
    .poll(() => sql("select count(*) from routines where name = 'B — Pull offline'"), { timeout: 20_000 })
    .toBe("1");

  // Profile shows the sync state.
  await a.page.goto("/perfil");
  await expect(a.page.getByText(/Sincronizado às/)).toBeVisible({ timeout: 20_000 });
  await expect(a.page.getByText("Conectado como")).toBeVisible();
});

test("the server ignores stale writes", async ({ request }) => {
  const id = sql("select id from routines where name = 'C — Leg day'");
  const response = await request.patch(`${BACKEND}/rest/v1/routines?id=eq.${id}`, {
    headers: { Authorization: `Bearer ${signAccessToken(USER_1)}` },
    data: { name: "stale", updated_at: "2000-01-01T00:00:00Z" },
  });
  expect(response.ok()).toBe(true);
  expect(sql(`select name from routines where id = '${id}'`)).toBe("C — Leg day");
});

test("another user sees none of it", async ({ browser, request }) => {
  const response = await request.get(`${BACKEND}/rest/v1/routines?select=id`, {
    headers: { Authorization: `Bearer ${signAccessToken(USER_2)}` },
  });
  expect(await response.json()).toEqual([]);

  const c = await device(browser, USER_2);
  await c.page.goto("/");
  await c.page.waitForURL("**/onboarding", { timeout: 20_000 });
});

test("signing out sends pending changes and clears the device", async ({ browser }) => {
  const a = await device(browser, USER_1);
  await a.page.goto("/fichas");
  await a.page.getByText("A — Peito, ombro e tríceps").click();
  await a.page.getByLabel("Nome da ficha").fill("A — Before sign out");
  await a.page.getByLabel("Nome da ficha").press("Enter");
  await a.page.getByRole("link", { name: "Voltar" }).click();
  await a.page.getByRole("link", { name: "Perfil" }).click();
  await a.page.getByRole("button", { name: "Sair da conta" }).click();
  await a.page.waitForURL("**/login");

  expect(sql("select count(*) from routines where name = 'A — Before sign out'")).toBe("1");
  const leftovers = await a.page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open("treino");
        open.onsuccess = () => {
          const req = open.result.transaction("routines").objectStore("routines").count();
          req.onsuccess = () => resolve(req.result);
        };
      }),
  );
  expect(leftovers).toBe(0);
});
