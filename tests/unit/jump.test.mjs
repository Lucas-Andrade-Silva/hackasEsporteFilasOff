import test from "node:test";
import assert from "node:assert/strict";
import {evaluateJump,makeJumpFrames,flightHeightCm,fitQuadratic} from "../../src/engine/protocols/jump.mjs";
const opts={source:"synthetic_pose_replay",normalizedUnitsPerMeter:.42};
for(const fps of [30,60,120])test("analytical jump at "+fps+" fps",()=>{const r=evaluateJump(makeJumpFrames({fps}),"volleyball",opts);assert.equal(r.status,"accepted");assert.ok(Math.abs(r.value-flightHeightCm(500))<3);assert.equal(r.uncertainty,null);assert.ok(r.diagnostics.fitR2>.99)});
for(const invalid of ["feet-cut","multiple","empty","no-jump","double","duplicate","gap","estimated","low-confidence","camera-drift"])test("gate "+invalid,()=>assert.notEqual(evaluateJump(makeJumpFrames({invalid}),"volleyball",opts).status,"accepted"));
test("real capture never eligible",()=>{const r=evaluateJump(makeJumpFrames(),"basketball",{source:"authorized_capture"});assert.equal(r.status,"experimental");assert.equal(r.uncertainty,null);assert.equal(r.diagnostics.parabolaHeightCm,null)});
test("fit independent quadratic",()=>{const f=fitQuadratic(Array.from({length:12},(_,i)=>({t:i*30,y:2*(i*.03)**2-0.6*i*.03+.5})));assert.ok(Math.abs(f.a-2)<1e-8);assert.ok(f.r2>.999999)});
test("no independent scale never accepted",()=>assert.equal(evaluateJump(makeJumpFrames(),"volleyball",{source:"synthetic_pose_replay"}).status,"experimental"));
