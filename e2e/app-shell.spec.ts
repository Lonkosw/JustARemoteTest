import { expect, test } from "@playwright/test";
import { failOnPageErrors, onboard } from "./helpers";

test("new user goes through onboarding to the home screen", async ({ page }) => {
  const noErrors = failOnPageErrors(page);
  await page.goto("/fichas");
  await page.waitForURL("**/onboarding");

  // Name is required.
  await expect(page.getByRole("button", { name: "Começar" })).toBeDisabled();

  await onboard(page, { name: "Theo Teste", height: "178", weight: "80,5" });
  await expect(page.getByRole("heading", { name: "Theo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Começar treino livre" })).toBeVisible();
  await expect(page.getByText("Você ainda não tem fichas.")).toBeVisible();
  noErrors();
});

test("profile edits persist and local mode is explained", async ({ page }) => {
  await onboard(page, { name: "Theo", height: "178" });
  await page.getByRole("link", { name: "Perfil" }).click();
  await expect(page.getByText("Modo local")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sair da conta" })).toHaveCount(0);

  await expect(page.getByLabel("Altura (cm)")).toHaveValue("178");
  await page.getByLabel("Nome").fill("Theo Editado");
  await page.getByLabel("Objetivo").selectOption("strength");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("button", { name: "Salvo ✓" })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Nome")).toHaveValue("Theo Editado");
  await expect(page.getByLabel("Objetivo")).toHaveValue("strength");
  await page.getByRole("link", { name: "Treinar" }).click();
  await expect(page.getByRole("heading", { name: "Theo" })).toBeVisible();
});

test("bottom navigation reaches every tab", async ({ page }) => {
  await onboard(page);
  for (const [link, heading] of [
    ["Fichas", "Fichas"],
    ["Evolução", "Evolução"],
    ["Perfil", "Perfil"],
  ]) {
    await page.getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: link })).toHaveClass(/text-accent/);
  }
});

test("login page sends local-mode users home", async ({ page }) => {
  await onboard(page);
  await page.goto("/login");
  await page.waitForURL((url) => url.pathname === "/");
});

test("web app manifest and icons are served", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ display: "standalone", lang: "pt-BR", start_url: "/" });
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok(), icon.src).toBe(true);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
  expect((await request.get("/sw.js")).ok()).toBe(true);
});
