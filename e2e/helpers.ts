import { expect, type Locator, type Page } from "@playwright/test";

export async function onboard(page: Page, values: { name?: string; height?: string; weight?: string } = {}) {
  await page.goto("/");
  await page.waitForURL("**/onboarding");
  await page.getByLabel("Nome").fill(values.name ?? "Theo");
  if (values.height) await page.getByLabel("Altura (cm)").fill(values.height);
  if (values.weight) await page.getByLabel("Peso (kg)").fill(values.weight);
  await page.getByRole("button", { name: "Começar" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

/** Apply a template from the templates screen. `name` is the button text, e.g. "ABC". */
export async function applyTemplate(page: Page, name: string, routines: number) {
  await page.goto("/fichas/modelos");
  await page.getByRole("button", { name: new RegExp(`^${name.replace(/[/]/g, "\\/")}\\b`) }).click();
  await page.getByRole("button", { name: `Usar ${name} (${routines} fichas)` }).click();
  await page.waitForURL("**/fichas");
}

export function routineCard(page: Page, name: string): Locator {
  return page.locator("main li", { hasText: name });
}

export async function startRoutine(page: Page, name: string) {
  await page.getByRole("link", { name: "Treinar" }).click();
  await routineCard(page, name).getByRole("button", { name: "Iniciar" }).click();
  await page.waitForURL("**/treino");
}

export function exerciseBlock(page: Page, name: string): Locator {
  return page.locator("section", { hasText: name });
}

/** Fill and complete set `n` of an exercise block. */
export async function logSet(block: Locator, n: number | string, kg: string | null, reps: string) {
  if (kg !== null) await block.getByLabel(`Carga da série ${n}`).fill(kg);
  await block.getByLabel(`Repetições da série ${n}`).fill(reps);
  await block.getByRole("button", { name: `Concluir série ${n}` }).click();
  await expect(block.getByRole("button", { name: `Desmarcar série ${n}` })).toBeVisible();
}

export async function skipRest(page: Page) {
  const skip = page.getByRole("button", { name: "Pular descanso" });
  if (await skip.isVisible()) await skip.click();
}

/** Accept every confirm() dialog for the rest of the test. */
export function acceptDialogs(page: Page) {
  page.on("dialog", (dialog) => void dialog.accept());
}

/** Fail the test on uncaught page errors. */
export function failOnPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return () => expect(errors, "uncaught page errors").toEqual([]);
}
