import { expect, test } from "@playwright/test";
import { acceptDialogs, applyTemplate, onboard, routineCard } from "./helpers";

test.beforeEach(async ({ page }) => {
  acceptDialogs(page);
  await onboard(page);
});

test("templates create editable routines", async ({ page }) => {
  await page.goto("/fichas/modelos");
  await page.getByRole("button", { name: /^ABC\b/ }).click();
  // The preview lists the routines and their exercises.
  await expect(page.getByText("C — Pernas")).toBeVisible();
  await expect(page.getByText("Cadeira extensora")).toBeVisible();
  await page.getByRole("button", { name: "Usar ABC (3 fichas)" }).click();
  await page.waitForURL("**/fichas");

  await expect(page.locator("main ul > li")).toHaveCount(3);
  await expect(routineCard(page, "A — Peito, ombro e tríceps")).toContainText("7 exercícios");
  await expect(routineCard(page, "C — Pernas")).toContainText("6 exercícios");
});

test("routines can be reordered", async ({ page }) => {
  await applyTemplate(page, "ABC", 3);
  const names = page.locator("main li p.font-semibold");
  await expect(names).toHaveText(["A — Peito, ombro e tríceps", "B — Costas e bíceps", "C — Pernas"]);
  await routineCard(page, "C — Pernas").getByRole("button", { name: "Mover para cima" }).click();
  await expect(names).toHaveText(["A — Peito, ombro e tríceps", "C — Pernas", "B — Costas e bíceps"]);
  await page.reload();
  await expect(names).toHaveText(["A — Peito, ombro e tríceps", "C — Pernas", "B — Costas e bíceps"]);
});

test("routine editor saves every field", async ({ page }) => {
  await applyTemplate(page, "ABC", 3);
  await page.getByText("A — Peito, ombro e tríceps").click();
  await page.waitForURL("**/fichas/editar?id=*");

  const items = page.locator("ol > li");
  await expect(items).toHaveCount(7);
  const supino = items.first();
  await expect(supino).toContainText("Supino reto com barra");

  await supino.getByRole("button", { name: "Mais uma série" }).click();
  await supino.getByRole("button", { name: "Menos uma série" }).click();
  await supino.getByRole("button", { name: "Mais uma série" }).click();
  await supino.getByPlaceholder("10-12").fill("6-8");
  await supino.getByPlaceholder("10-12").blur();
  await supino.locator("select").selectOption("180");

  await supino.getByRole("button", { name: "Mover para baixo" }).click();
  await expect(items.nth(1)).toContainText("Supino reto com barra");
  await items.last().getByRole("button", { name: "Remover exercício" }).click();
  await expect(items).toHaveCount(6);

  await page.getByLabel("Nome da ficha").fill("A — Push pesado");
  await page.getByLabel("Nome da ficha").press("Enter");

  await page.reload();
  await expect(page.getByLabel("Nome da ficha")).toHaveValue("A — Push pesado");
  await expect(items).toHaveCount(6);
  const moved = items.nth(1);
  await expect(moved).toContainText("Supino reto com barra");
  await expect(moved.locator("span.tabular-nums")).toHaveText("5");
  await expect(moved.locator("input")).toHaveValue("6-8");
  await expect(moved.locator("select")).toHaveValue("180");
});

test("exercise picker searches, filters and creates custom exercises", async ({ page }) => {
  await page.goto("/fichas");
  await page.getByRole("button", { name: "Nova ficha" }).click();
  await page.waitForURL("**/fichas/editar?id=*");
  await expect(page.getByText("Ficha vazia")).toBeVisible();

  await page.getByRole("button", { name: "+ Adicionar exercício" }).click();
  const dialog = page.getByRole("dialog", { name: "Escolher exercícios" });
  const rows = dialog.locator("li button[aria-pressed]");

  // Accent-insensitive, word-prefix search: "lateral" must not match "unilateral".
  await dialog.getByLabel("Buscar exercício").fill("elevacao lateral");
  await expect(rows).toHaveCount(3);
  await dialog.getByLabel("Buscar exercício").fill("sup incl");
  await expect(rows.first()).toContainText("Supino inclinado");
  await rows.first().click();

  await dialog.getByLabel("Buscar exercício").fill("");
  await dialog.getByRole("button", { name: "Panturrilha", exact: true }).click();
  await expect(rows).toHaveCount(5);
  await rows.filter({ hasText: "Panturrilha sentado" }).click();

  await dialog.getByRole("button", { name: "Criar", exact: true }).first().click();
  await page.getByLabel("Nome", { exact: true }).fill("Supino com corrente");
  await page.getByLabel("Grupo muscular").selectOption("chest");
  await page.getByRole("button", { name: "Criar", exact: true }).last().click();

  await dialog.getByRole("button", { name: "Adicionar 3 exercícios" }).click();
  const items = page.locator("ol > li");
  await expect(items).toHaveCount(3);
  await expect(items.nth(2)).toContainText("Supino com corrente");

  // The custom exercise is available next time too.
  await page.getByRole("button", { name: "+ Adicionar exercício" }).click();
  await dialog.getByLabel("Buscar exercício").fill("corrente");
  await expect(rows.first()).toContainText("Personalizado");
});

test("deleting a routine removes it from the list and home", async ({ page }) => {
  await applyTemplate(page, "Upper / Lower", 4);
  await page.getByText("Inferior B").click();
  await page.getByRole("button", { name: "Excluir ficha" }).click();
  await page.waitForURL("**/fichas");
  await expect(page.locator("main ul > li")).toHaveCount(3);
  await page.getByRole("link", { name: "Treinar" }).click();
  await expect(page.getByText("Superior A")).toBeVisible();
  await expect(page.getByText("Inferior B")).toHaveCount(0);
});

test("missing routine id shows a friendly message", async ({ page }) => {
  await page.goto("/fichas/editar?id=does-not-exist");
  await expect(page.getByText("Ficha não encontrada.")).toBeVisible();
});
