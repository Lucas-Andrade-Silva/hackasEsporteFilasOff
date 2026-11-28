import test from "node:test";
import assert from "node:assert/strict";
const base=process.env.BASE_URL||"http://localhost:3000";
const key="00000000-0000-4000-8000-000000000000";
async function post(body,origin=base){return fetch(base+"/api/demo",{method:"POST",headers:{"content-type":"application/json",origin},body:JSON.stringify(body)})}
test("app pages and manifest render",async()=>{for(const path of ["/","/bem-vindo","/onboarding","/cadastro","/entrar","/ranking","/evolucao","/perfil","/treinos/v-impulsao","/exercicio/v-bloqueio","/manifest.webmanifest"]){const r=await fetch(base+path);assert.equal(r.status,200,path)}});
test("local session mode is explicit",async()=>{const r=await fetch(base+"/api/demo");assert.equal(r.status,200);assert.deepEqual(await r.json(),{persistence:"local",attempts:[]})});
test("server computes fixture, ignores no arbitrary score",async()=>{const r=await post({fixtureId:"block-next",idempotencyKey:key});assert.equal(r.status,200);const a=await r.json();assert.equal(a.attempt.measurement.value,30.7);assert.equal(a.attempt.rankingEligible,true);assert.equal(a.attempt.id,key);assert.equal((await post({fixtureId:"block-next",idempotencyKey:key,score:999})).status,400)});
test("rejected fixture has no value and cannot rank",async()=>{const r=await post({fixtureId:"feet-cut",idempotencyKey:key});assert.equal(r.status,200);const a=await r.json();assert.equal(a.attempt.measurement.value,null);assert.equal(a.attempt.rankingEligible,false)});
test("mutation origin checked",async()=>assert.equal((await post({fixtureId:"block-base",idempotencyKey:key},"https://example.invalid")).status,403));
test("oversized payload rejected",async()=>assert.equal((await post({fixtureId:"x".repeat(3000),idempotencyKey:key})).status,413));
test("reset route responds in local mode",async()=>{const r=await fetch(base+"/api/demo",{method:"DELETE",headers:{origin:base}});assert.equal(r.status,200);assert.equal((await r.json()).ok,true)});
