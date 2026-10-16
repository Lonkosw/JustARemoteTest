import { expect, test } from "@playwright/test";
import {
  acceptDialogs,
  applyTemplate,
  exerciseBlock,
  failOnPageErrors,
  logSet,
  onboard,
  routineCard,
  skipRest,
  startRoutine,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  acceptDialogs(page);
  await onboard(page);
  await applyTemplate(page, "ABC", 3);
});

test("full workout: log sets, rest timer, warm-up, finish and summary", async ({ page }) => {
  const noErrors = failOnPageErrors(page);
  await page.getByRole("link", { name: "Treinar" }).click();
  await expect(routineCard(page, "A — Peito").getByText("Próximo da sequência")).toBeVisible();
  await startRoutine(page, "A — Peito");
  await expect(page.getByText("0/22 séries")).toBeVisible();

  // Rest timer starts with the routine's rest (2:00) and can be adjusted.
  const supino = exerciseBlock(page, "Supino reto com barra");
  await logSet(supino, 1, "60", "10");
  const timer = page.getByRole("timer");
  await expect(timer).toContainText("2:0");
  await page.getByRole("button", { name: "Mais 15 segundos" }).click();
  await expect(timer).toContainText("2:1");
  await page.getByRole("button", { name: "Menos 15 segundos" }).click();
  await page.getByRole("button", { name: "Pular descanso" }).click();
  await expect(timer).toHaveCount(0);

  for (const n of [2, 3, 4]) await logSet(supino, n, "60", "10");
  await skipRest(page);

  // Warm-up: no rest timer, not counted as working set.
  const incline = exerciseBlock(page, "Supino inclinado com halteres");
  await incline.getByRole("button", { name: "+ Série" }).click();
  await incline.getByRole("button", { name: /^Série 1\. Tocar/ }).click();
  await expect(incline.getByRole("button", { name: /aquecimento\. Tocar/ })).toBeVisible();
  await logSet(incline, "A", "14", "15");
  await expect(timer).toHaveCount(0);
  await logSet(incline, 1, "22,5", "12");
  await skipRest(page);

  // Empty set completes with the plan's minimum reps (10 of 10-12).
  await incline.getByRole("button", { name: "Concluir série 2" }).click();
  await expect(incline.getByLabel("Repetições da série 2")).toHaveValue("10");
  await skipRest(page);

  // Progress survives a reload, including a running rest timer.
  await supino.getByRole("button", { name: "+ Série" }).click();
  await logSet(supino, 5, "50", "10");
  await page.reload();
  await expect(page.getByText(/^\d+:\d+ · 8\/24 séries$/)).toBeVisible();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(supino.getByLabel("Carga da série 1")).toHaveValue("60");
  await skipRest(page);

  // Home shows the active workout and offers to resume it.
  await page.getByRole("link", { name: "Treinar" }).click();
  await page.getByText("Treino em andamento").click();
  await page.waitForURL("**/treino");

  await page.getByRole("button", { name: "Finalizar" }).click();
  await page.waitForURL("**/treino/resumo?id=*");
  await expect(page.getByText("Treino concluído")).toBeVisible();
  const stats = page.locator("main .grid-cols-3");
  await expect(stats).toContainText("Séries7"); // warm-up excluded, unfinished dropped
  await expect(stats).toContainText("3.170 kg"); // 4 x 600 + 500 + 22.5 x 12; set 2 has no load
  await expect(page.getByText("22,5 kg × 12 · 10 reps")).toBeVisible();

  await page.getByRole("link", { name: "Concluir" }).click();
  await expect(routineCard(page, "A — Peito")).toContainText("Feito hoje");
  await expect(routineCard(page, "B — Costas").getByText("Próximo da sequência")).toBeVisible();
  noErrors();
});

test("next session shows previous loads and suggests progression", async ({ page }) => {
  await startRoutine(page, "A — Peito");
  const supino = exerciseBlock(page, "Supino reto com barra");
  for (const n of [1, 2, 3, 4]) await logSet(supino, n, "60", "10");
  const incline = exerciseBlock(page, "Supino inclinado com halteres");
  await logSet(incline, 1, "22", "10"); // 10-12: top not reached
  await skipRest(page);
  await page.getByRole("button", { name: "Finalizar" }).click();
  await page.waitForURL("**/treino/resumo?id=*");

  await startRoutine(page, "A — Peito");
  await expect(supino).toContainText("Sugestão: 62,5 kg × 8 reps");
  await expect(supino).toContainText("60 × 10");
  await expect(supino.getByLabel("Carga da série 1")).toHaveAttribute("placeholder", "62,5");
  await expect(supino.getByLabel("Repetições da série 1")).toHaveAttribute("placeholder", "8");
  await expect(incline).not.toContainText("Sugestão");
  await expect(incline.getByLabel("Carga da série 1")).toHaveAttribute("placeholder", "22");

  // Completing with empty inputs uses the suggestion.
  await supino.getByRole("button", { name: "Concluir série 1" }).click();
  await expect(supino.getByLabel("Carga da série 1")).toHaveValue("62,5");
  await expect(supino.getByLabel("Repetições da série 1")).toHaveValue("8");
  // Heavier than ever: live record badge.
  await expect(supino.getByText("🏆 Recorde")).toBeVisible();
});

test("free workout: add exercises, add and remove sets, remove exercise", async ({ page }) => {
  await page.getByRole("link", { name: "Treinar" }).click();
  await page.getByRole("button", { name: "Começar treino livre" }).click();
  await page.waitForURL("**/treino");
  await expect(page.getByText("Adicione o primeiro exercício.")).toBeVisible();

  await page.getByRole("button", { name: "+ Adicionar exercício" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Buscar exercício").fill("barra fixa pronada");
  await dialog.locator("li button[aria-pressed]").first().click();
  await dialog.getByLabel("Buscar exercício").fill("prancha lateral");
  await dialog.locator("li button[aria-pressed]").first().click();
  await dialog.getByRole("button", { name: "Adicionar 2 exercícios" }).click();

  const pullups = exerciseBlock(page, "Barra fixa pronada");
  await expect(pullups.getByRole("button", { name: /^Concluir série/ })).toHaveCount(3);
  await pullups.getByRole("button", { name: "+ Série" }).click();
  await expect(pullups.getByRole("button", { name: /^Concluir série/ })).toHaveCount(4);
  await pullups.getByRole("button", { name: "− Série" }).click();
  await expect(pullups.getByRole("button", { name: /^Concluir série/ })).toHaveCount(3);

  // Bodyweight: reps without load.
  await logSet(pullups, 1, null, "8");
  await skipRest(page);

  await exerciseBlock(page, "Prancha lateral").getByRole("button", { name: "Remover exercício" }).click();
  await expect(exerciseBlock(page, "Prancha lateral")).toHaveCount(0);

  await page.getByRole("button", { name: "Finalizar" }).click();
  await page.waitForURL("**/treino/resumo?id=*");
  await expect(page.getByText("Treino livre")).toBeVisible();
  await expect(page.getByText("8 reps")).toBeVisible();
});

test("only one active workout at a time", async ({ page }) => {
  await startRoutine(page, "A — Peito");
  await page.getByRole("link", { name: "Treinar" }).click();
  await expect(page.getByRole("button", { name: "Começar treino livre" })).toHaveCount(0);
  // Starting another routine offers to continue the active one instead.
  await routineCard(page, "B — Costas").getByRole("button", { name: "Iniciar" }).click();
  await page.waitForURL("**/treino");
  await expect(page.getByRole("heading", { name: "A — Peito, ombro e tríceps" })).toBeVisible();
});

test("finishing with nothing done discards the workout", async ({ page }) => {
  await startRoutine(page, "C — Pernas");
  await page.getByRole("button", { name: "Finalizar" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByText("Treino em andamento")).toHaveCount(0);
  await page.getByRole("link", { name: "Evolução" }).click();
  await expect(page.getByText("Seus treinos finalizados aparecem aqui")).toBeVisible();
});

test("discard button removes an in-progress workout", async ({ page }) => {
  await startRoutine(page, "B — Costas");
  await logSet(exerciseBlock(page, "Puxada frontal aberta"), 1, "50", "10");
  await page.getByRole("button", { name: "Descartar treino" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByText("Treino em andamento")).toHaveCount(0);
  await page.goto("/treino");
  await expect(page.getByText("Nenhum treino em andamento.")).toBeVisible();
});
