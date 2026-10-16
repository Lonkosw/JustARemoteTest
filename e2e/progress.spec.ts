import { expect, test, type Page } from "@playwright/test";
import { acceptDialogs, applyTemplate, exerciseBlock, logSet, onboard, routineCard, skipRest, startRoutine } from "./helpers";

// Two sessions of routine A a week apart (the browser clock is fixed per
// session), the second one setting records.
const DAY1 = new Date("2026-03-02T10:00:00");
const DAY8 = new Date("2026-03-09T10:00:00");

async function doSession(page: Page, kg: string, reps: string) {
  await startRoutine(page, "A — Peito");
  const supino = exerciseBlock(page, "Supino reto com barra");
  for (const n of [1, 2, 3, 4]) {
    await logSet(supino, n, kg, reps);
    await skipRest(page);
  }
  const lateral = exerciseBlock(page, "Elevação lateral com halteres");
  await logSet(lateral, 1, "10", "15");
  await skipRest(page);
  await page.getByRole("button", { name: "Finalizar" }).click();
  await page.waitForURL("**/treino/resumo?id=*");
}

test.beforeEach(async ({ page }) => {
  acceptDialogs(page);
  await page.clock.setFixedTime(DAY1);
  await onboard(page);
  await applyTemplate(page, "ABC", 3);
  await doSession(page, "60", "10");
  // First session ever: nothing to beat, so no records.
  await expect(page.getByText(/novo recorde/i)).toHaveCount(0);

  await page.clock.setFixedTime(DAY8);
  await page.goto("/");
  await expect(routineCard(page, "A — Peito")).toContainText("Feito há 7 dias");
  await doSession(page, "62,5", "8");
});

test("summary lists the records of the session", async ({ page }) => {
  const records = page.locator("section", { hasText: "Novo recorde" });
  await expect(records).toBeVisible();
  // 62.5 is the heaviest supino ever; its e1RM (79.2) is below 60 x 10 (80).
  await expect(records).toContainText("Supino reto com barra: 62,5 kg × 8");
  await expect(records).toContainText("Maior carga");
  await expect(records).not.toContainText("1RM estimado");
  await expect(page.getByText("62,5 kg × 8 🏆")).toBeVisible();
});

test("progress tab: week stats, muscle groups and history", async ({ page }) => {
  await page.getByRole("link", { name: "Evolução" }).click();
  await expect(page.getByText("Treinos na semana").locator("..")).toContainText("1");
  await expect(page.getByText("Séries na semana").locator("..")).toContainText("5");
  await expect(page.getByText("Volume na semana").locator("..")).toContainText("2.150 kg"); // 4 x 500 + 150

  const groups = page.locator("section", { hasText: "Séries por grupo muscular" });
  await expect(groups.locator("li", { hasText: "Peito" })).toContainText("4");
  await expect(groups.locator("li", { hasText: "Ombros" })).toContainText("1");

  // Day 1 is 7 days back, outside the "last 7 days" window.
  const history = page.locator("main a[href^='/treino/resumo']");
  await expect(history).toHaveCount(2);
  await expect(page.getByRole("heading", { name: /março de 2026/i })).toBeVisible();
  await expect(history.first()).toContainText("🏆 1");
  await expect(history.last()).not.toContainText("🏆");

  // Old workouts open in read mode and can be deleted.
  await history.last().click();
  await expect(page.getByText("Treino concluído")).toHaveCount(0);
  await page.getByRole("button", { name: "Excluir treino" }).click();
  await page.waitForURL("**/evolucao");
  await expect(history).toHaveCount(1);
});

test("exercise list and detail with records and chart", async ({ page }) => {
  await page.goto("/evolucao");
  await page.getByRole("tab", { name: "Exercícios" }).click();
  const supinoRow = page.locator("main li", { hasText: "Supino reto com barra" });
  await expect(supinoRow).toContainText("2 sessões");
  await expect(supinoRow).toContainText("80 kg");
  await page.getByLabel("Buscar exercício").fill("elevacao");
  await expect(page.locator("main a[href^='/evolucao/exercicio']")).toHaveCount(1);
  await page.getByLabel("Buscar exercício").fill("");

  await supinoRow.click();
  await page.waitForURL("**/evolucao/exercicio?id=supino-reto-barra");
  const tiles = page.getByRole("region", { name: "Recordes" });
  await expect(tiles).toContainText("1RM estimado80 kg");
  await expect(tiles).toContainText("Maior carga62,5 kg");
  await expect(tiles).toContainText("Sessões2");

  const chart = page.getByRole("img", { name: "1RM estimado por sessão" });
  await expect(chart).toBeVisible();
  await expect(chart.locator("circle")).toHaveCount(1); // end marker only
  const box = (await chart.boundingBox())!;
  await page.mouse.click(box.x + box.width - 20, box.y + box.height / 2);
  await expect(page.getByRole("tooltip")).toContainText("Melhor: 62,5 kg × 8");

  await page.getByRole("button", { name: "Maior carga" }).click();
  await expect(page.getByRole("img", { name: "Maior carga por sessão" })).toBeVisible();

  const sessions = page.locator("main a[href^='/treino/resumo']");
  await expect(sessions).toHaveCount(2);
  await expect(sessions.first()).toContainText("62,5 × 8 · 62,5 × 8 · 62,5 × 8 · 62,5 × 8");
});

test("bodyweight exercises chart reps", async ({ page }) => {
  // Single session of a bodyweight exercise: records show reps, no chart yet.
  await page.getByRole("link", { name: "Treinar" }).click();
  await page.getByRole("button", { name: "Começar treino livre" }).click();
  await page.getByRole("button", { name: "+ Adicionar exercício" }).click();
  await page.getByRole("dialog").getByLabel("Buscar exercício").fill("flexao de braco");
  await page.getByRole("dialog").locator("li button[aria-pressed]").first().click();
  await page.getByRole("button", { name: "Adicionar 1 exercício" }).click();
  await logSet(exerciseBlock(page, "Flexão de braço"), 1, null, "20");
  await skipRest(page);
  await page.getByRole("button", { name: "Finalizar" }).click();
  await page.waitForURL("**/treino/resumo?id=*");

  await page.goto("/evolucao/exercicio?id=flexao");
  await expect(page.getByRole("region", { name: "Recordes" })).toContainText("Mais repetições20");
  await expect(page.getByText("O gráfico aparece a partir da segunda sessão.")).toBeVisible();
});
