import {test,expect} from "@playwright/test";
test("real model receives decoded synthetic clip, no score in ranking",async({page})=>{
 test.skip(process.env.RUN_MODEL_QA!=="1","Optional real model/CDN verification");
 test.setTimeout(150000);
 await page.goto("/demo");
 await page.getByRole("button",{name:"Testar inferência em personagem sintético"}).click();
 await expect(page.getByTestId("model-summary")).toHaveText(/\d+\/\d+ quadros com uma pose · /,{timeout:120000});
 const summary=await page.getByTestId("model-summary").innerText();
 console.log("REAL_MODEL_RESULT "+summary);
 const matches=summary.match(/(\d+)\/(\d+)/);
 expect(Number(matches?.[2]??0)).toBeGreaterThan(0);
 // Zero detected poses is not a successful positive inference; record and fail the model gate.
 expect(Number(matches?.[1]??0)).toBeGreaterThan(0);
 console.log("REAL_MODEL_MEASUREMENT "+await page.getByTestId("model-result").innerText());
 await expect(page.getByTestId("model-result")).toHaveText(/Resultado (experimental|rejected)/);
});
