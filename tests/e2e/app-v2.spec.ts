import { test, expect } from "@playwright/test";

// Sem Supabase configurado no CI: cobre o caminho de quem ainda não tem conta.

test("sem login, o app manda para as boas-vindas", async ({ page }) => {
  for (const path of ["/", "/ranking", "/evolucao", "/perfil", "/treinos/v-impulsao", "/exercicio/v-bloqueio"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/bem-vindo$/);
  }
  await expect(page.getByRole("heading", { name: /Salta.*Evolui.*Aparece/s })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(0);
});

test("onboarding de 7 passos leva ao cadastro e exige 18+", async ({ page }) => {
  await page.goto("/bem-vindo");
  await page.getByRole("link", { name: /Começar/ }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByRole("button", { name: "Vôlei" }).click();
  await expect(page.getByRole("heading", { name: "Qual é sua posição?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Armador(a)" })).toHaveCount(0);
  await page.getByRole("button", { name: "Líbero" }).click();
  await page.getByRole("button", { name: "Mais de 3 anos" }).click();
  await page.getByRole("button", { name: "4 ou mais" }).click();
  await page.getByRole("button", { name: "Ganhar agilidade" }).click();
  await page.getByRole("button", { name: "Quadra ou espaço amplo" }).click();

  const create = page.getByRole("button", { name: "Criar minha conta" });
  await expect(create).toBeDisabled();
  await page.getByRole("checkbox").check();
  await create.click();

  await expect(page).toHaveURL(/\/cadastro$/);
  await expect(page.getByRole("heading", { name: "Crie seu perfil de atleta" })).toBeVisible();
  await expect(page.getByText("Conexão com o banco pendente.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar conta" })).toBeDisabled();
});

test("cadastro sem onboarding volta para as perguntas", async ({ page }) => {
  await page.goto("/cadastro");
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("voltar no onboarding preserva a resposta", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Basquete" }).click();
  await expect(page.getByRole("button", { name: "Pivô", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page.getByRole("button", { name: "Basquete" })).toHaveAttribute("aria-pressed", "true");
});
