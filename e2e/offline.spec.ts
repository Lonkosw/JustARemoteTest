import { expect, test } from "@playwright/test";
import { acceptDialogs, applyTemplate, exerciseBlock, logSet, onboard, startRoutine } from "./helpers";

test("the installed app works without network", async ({ page, context }) => {
  acceptDialogs(page);
  await onboard(page);
  await applyTemplate(page, "ABC", 3);
  await page.getByText("A — Peito, ombro e tríceps").click();
  const editorUrl = page.url();

  // Wait for the service worker to precache the pages, then cut the network.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);

  for (const [path, text] of [
    ["/", "Suas fichas"],
    ["/fichas", "C — Pernas"],
    ["/fichas/modelos", "Push / Pull / Legs"],
    ["/evolucao", "Evolução"],
    ["/perfil", "Modo local"],
    // Never opened online and not linked from any visited page.
    ["/evolucao/exercicio?id=agachamento-livre", "Nenhum treino finalizado com este exercício"],
    ["/treino", "Nenhum treino em andamento."],
  ]) {
    await page.goto(path);
    await expect(page.getByText(text).first(), path).toBeVisible();
  }

  await page.goto(editorUrl);
  await expect(page.locator("ol > li")).toHaveCount(7);

  // A whole workout offline.
  await page.goto("/");
  await startRoutine(page, "A — Peito");
  await logSet(exerciseBlock(page, "Supino reto com barra"), 1, "60", "10");
  await page.getByRole("button", { name: "Finalizar" }).click();
  await page.waitForURL("**/treino/resumo?id=*");
  await expect(page.getByText("Treino concluído")).toBeVisible();
});
