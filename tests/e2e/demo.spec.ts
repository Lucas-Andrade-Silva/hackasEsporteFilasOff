import {test,expect} from "@playwright/test";
test("complete demo, persistence, ranking, rejection, reset, session isolation",async({page,browser})=>{
 await page.goto("/");
 await expect(page.getByRole("heading",{name:/Salta.*Evolui.*Aparece/s})).toBeVisible();
 await page.getByRole("link",{name:"Experimentar demo"}).click();
 await expect(page.getByRole("button",{name:/Bloqueio · primeira tentativa/})).toBeEnabled();
 await page.getByRole("button",{name:/Bloqueio · primeira tentativa/}).click();
 await expect(page).toHaveURL(/\/results$/);
 await expect(page.locator(".metric")).toContainText("19,6");
 await expect(page.getByText("Válido na simulação",{exact:false})).toBeVisible();
 await page.getByRole("link",{name:"Ver ranking"}).click();
 await expect(page.getByText("4 · Você (demo)",{exact:true})).toBeVisible();
 await page.getByRole("link",{name:"Nova tentativa"}).click();
 await page.getByRole("button",{name:/Bloqueio · segunda tentativa/}).click();
 await expect(page.locator(".metric")).toContainText("30,7");
 await page.getByRole("link",{name:"Ver ranking"}).click();
 await expect(page.getByText("2 · Você (demo)",{exact:true})).toBeVisible();
 await page.getByRole("link",{name:"Nova tentativa"}).click();
 await page.getByRole("button",{name:/Caso inválido/}).click();
 await expect(page.locator(".metric")).toHaveText("—");
 await expect(page.getByText("Rejeitado",{exact:false})).toBeVisible();
 await page.getByRole("link",{name:"Ver Passaporte"}).click();
 await expect(page.locator(".list-row")).toHaveCount(3);
 await page.reload();
 await expect(page.locator(".list-row")).toHaveCount(3);
 const independent=await browser.newContext();
 try {
   const second=await independent.newPage();
   await second.goto("http://localhost:3000/passport");
   await expect(second.getByText("Seu primeiro movimento começa aqui.")).toBeVisible();
   await page.getByRole("link",{name:"Privacidade"}).click();
   await page.getByRole("button",{name:"Excluir dados da minha demo"}).click();
   await expect(page.getByText("Nenhuma tentativa carregada na sessão.")).toBeVisible();
   await page.getByRole("link",{name:"Evolução"}).click();
   await expect(page.getByText("Seu primeiro movimento começa aqui.")).toBeVisible();
 } finally {await independent.close()}
});
test("basketball demo and capture disabled",async({page})=>{
 await page.goto("/missions");
 await page.getByRole("link",{name:"Experimentar missão sintética"}).nth(1).click();
 await page.getByRole("button",{name:/Rebote · primeira tentativa/}).click();
 await expect(page.locator(".metric")).toContainText("23");
 await expect(page.getByText(/Basquete · Rebote/)).toBeVisible();
 await page.goto("/capture");
 await expect(page.getByText("Desativada neste ambiente.",{exact:false})).toBeVisible();
 await expect(page.locator("video")).toHaveCount(0);
});

test("Ghost compares two valid synthetic attempts on shared clock",async({page})=>{
 await page.goto("/demo");
 await page.getByRole("button",{name:/Bloqueio · primeira tentativa/}).click();
 await expect(page.locator(".metric")).toContainText("19,6");
 await page.getByRole("link",{name:"Tentar novamente"}).click();
 await page.getByRole("button",{name:/Bloqueio · segunda tentativa/}).click();
 await expect(page.locator(".metric")).toContainText("30,7");
 await page.getByRole("link",{name:"Comparar no Ghost"}).click();
 await expect(page.getByRole("heading",{name:"Ghost Mode"})).toBeVisible();
 await expect(page.getByText("Diferença sintética: 11,1 cm")).toBeVisible();
 await page.getByRole("slider").fill("300");
 await expect(page.getByText("Tempo após decolagem: 300 ms")).toBeVisible();
});
