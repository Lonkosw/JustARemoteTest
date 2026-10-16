import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { acceptDialogs, failOnPageErrors, onboard } from "./helpers";

const PHOTO_1 = path.join(__dirname, "fixtures/photo-1.jpg");
const PHOTO_2 = path.join(__dirname, "fixtures/photo-2.jpg");

test.beforeEach(async ({ page }) => {
  acceptDialogs(page);
  await page.clock.setFixedTime(new Date("2026-03-31T09:00:00"));
  // Onboarding weight becomes the first entry.
  await onboard(page, { height: "180", weight: "82" });
});

async function openBody(page: Page) {
  await page.goto("/evolucao?aba=corpo");
  await expect(page.getByRole("tab", { name: "Corpo" })).toHaveAttribute("aria-selected", "true");
}

async function addMeasurement(page: Page, date: string, fields: Record<string, string>) {
  await page.getByRole("link", { name: "Registrar peso e medidas" }).click();
  await page.waitForURL("**/corpo/medidas");
  await page.getByLabel("Data").fill(date);
  for (const [label, value] of Object.entries(fields)) await page.getByLabel(label).fill(value);
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.waitForURL("**/evolucao?aba=corpo");
}

test("measurements: record, chart, change over 30 days, edit and delete", async ({ page }) => {
  const noErrors = failOnPageErrors(page);
  await openBody(page);
  await expect(page.getByText("Peso atual").locator("..")).toContainText("82 kg");
  await expect(page.getByText("IMC").locator("..")).toContainText("25,3");
  await expect(page.getByText("O gráfico aparece a partir do segundo registro.")).toBeVisible();

  // An empty form cannot be saved.
  await page.getByRole("link", { name: "Registrar peso e medidas" }).click();
  await expect(page.getByRole("button", { name: "Salvar" })).toBeDisabled();
  await page.getByLabel("Gordura corporal (%)").fill("120");
  await expect(page.getByText("Gordura corporal precisa ser menor que 100%.")).toBeVisible();
  await page.goBack();

  await page.clock.setFixedTime(new Date("2026-05-02T09:00:00"));
  await page.reload();
  await addMeasurement(page, "2026-04-15", { "Peso (kg)": "80,6", "Cintura (cm)": "88" });
  await addMeasurement(page, "2026-05-02", { "Peso (kg)": "79,4", "Cintura (cm)": "86,5", "Braço (cm)": "38" });

  await expect(page.getByText("Peso atual").locator("..")).toContainText("79,4 kg");
  // Change against the newest entry 30+ days back (31 Mar, 82 kg).
  await expect(page.getByText("−2,6 kg em 30 dias")).toBeVisible();
  await expect(page.getByRole("img", { name: "Peso por sessão" })).toBeVisible();
  await page.getByRole("button", { name: "Cintura" }).click();
  await expect(page.getByRole("img", { name: "Cintura por sessão" })).toBeVisible();
  // Arm has a single value: no chart yet.
  await page.getByRole("button", { name: "Braço" }).click();
  await expect(page.getByText("O gráfico aparece a partir do segundo registro.")).toBeVisible();

  const entries = page.locator("section", { hasText: "Registros" }).locator("li");
  await expect(entries).toHaveCount(3);
  await expect(entries.first()).toContainText("79,4 kg · Cintura 86,5 cm · Braço 38 cm");

  await entries.nth(1).click();
  await page.waitForURL("**/corpo/medidas?id=*");
  await expect(page.getByRole("heading", { name: "Editar registro" })).toBeVisible();
  await expect(page.getByLabel("Peso (kg)")).toHaveValue("80,6");
  await page.getByLabel("Peso (kg)").fill("80,2");
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.waitForURL("**/evolucao?aba=corpo");
  await expect(entries.nth(1)).toContainText("80,2 kg");

  await entries.nth(1).click();
  await page.getByRole("button", { name: "Excluir registro" }).click();
  await page.waitForURL("**/evolucao?aba=corpo");
  await expect(entries).toHaveCount(2);
  noErrors();
});

test("progress photos: add, view, edit, compare and delete", async ({ page }) => {
  const noErrors = failOnPageErrors(page);
  await openBody(page);
  await expect(page.getByText("Tire fotos na mesma pose")).toBeVisible();

  // First photo, back-dated.
  await page.getByLabel("Escolher foto").setInputFiles(PHOTO_1);
  const sheet = page.getByRole("dialog", { name: "Nova foto" });
  await expect(sheet.getByRole("img", { name: "Pré-visualização" })).toBeVisible();
  await sheet.getByLabel("Data").fill("2026-03-01");
  await sheet.getByLabel("Pose").selectOption("front");
  await sheet.getByRole("button", { name: "Salvar foto" }).click();
  await expect(sheet).toHaveCount(0);

  await page.getByLabel("Escolher foto").setInputFiles(PHOTO_2);
  await sheet.getByRole("button", { name: "Salvar foto" }).click();

  const thumbs = page.getByRole("button", { name: /^Foto / });
  await expect(thumbs).toHaveCount(2);
  // Newest first; images render from IndexedDB as blob: URLs.
  await expect(thumbs.first()).toHaveAccessibleName(/Foto Frente de 31 de mar/);
  await expect(thumbs.first().locator("img")).toHaveAttribute("src", /^blob:/);

  // Stored resized as JPEG.
  const sizes = await page.evaluate(
    () =>
      new Promise<{ type: string; full: number; thumb: number }[]>((resolve) => {
        const open = indexedDB.open("treino");
        open.onsuccess = () => {
          const req = open.result.transaction("photo_files").objectStore("photo_files").getAll();
          req.onsuccess = () =>
            resolve(req.result.map((f: { full: Blob; thumb: Blob }) => ({ type: f.full.type, full: f.full.size, thumb: f.thumb.size })));
        };
      }),
  );
  expect(sizes).toHaveLength(2);
  for (const s of sizes) {
    expect(s.type).toBe("image/jpeg");
    expect(s.thumb).toBeLessThan(s.full);
  }

  // Photo page: change pose.
  await thumbs.first().click();
  await page.waitForURL("**/corpo/foto?id=*");
  await expect(page.getByRole("img", { name: /Foto de 31 de mar/ })).toBeVisible();
  await expect(page.getByText("Frente · 82 kg")).toBeVisible();
  await page.getByLabel("Pose").selectOption("side");
  await expect(page.getByText("Lado · 82 kg")).toBeVisible();
  await page.goBack();

  // Compare: older on the left.
  await page.getByRole("button", { name: "Comparar" }).click();
  await thumbs.first().click();
  await thumbs.last().click();
  await page.waitForURL("**/corpo/comparar?a=*&b=*");
  await expect(page.getByRole("heading", { name: "Antes e depois" })).toBeVisible();
  await expect(page.getByText("30 dias")).toBeVisible();
  const captions = page.locator("figcaption");
  await expect(captions.first()).toContainText("01 de mar");
  await expect(captions.last()).toContainText("31 de mar");
  await page.goBack();

  // Delete.
  await thumbs.first().click();
  await page.getByRole("button", { name: "Excluir foto" }).click();
  await page.waitForURL("**/evolucao?aba=corpo");
  await expect(thumbs).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Comparar" })).toHaveCount(0);
  noErrors();
});

test("an image that cannot be read shows an error", async ({ page }) => {
  await openBody(page);
  await page.getByLabel("Escolher foto").setInputFiles({ name: "broken.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") });
  await page.getByRole("button", { name: "Salvar foto" }).click();
  await expect(page.getByText("Não foi possível ler esta imagem.")).toBeVisible();
});

test("photos and measurements work offline", async ({ page, context }) => {
  await openBody(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);

  // Same day as the onboarding entry; the frozen test clock makes their
  // creation times equal, so check the list rather than "latest".
  await addMeasurement(page, "2026-03-31", { "Peso (kg)": "81,5" });
  await expect(page.locator("section", { hasText: "Registros" }).locator("li")).toHaveCount(2);
  await expect(page.locator("section", { hasText: "Registros" })).toContainText("81,5 kg");
  await page.getByLabel("Escolher foto").setInputFiles(PHOTO_1);
  await page.getByRole("button", { name: "Salvar foto" }).click();
  await expect(page.getByRole("button", { name: /^Foto / }).locator("img")).toHaveAttribute("src", /^blob:/);
});
