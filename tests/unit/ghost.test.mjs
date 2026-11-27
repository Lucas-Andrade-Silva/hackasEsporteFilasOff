import test from "node:test";
import assert from "node:assert/strict";
import {alignGhost} from "../../src/engine/replay/ghost.mjs";
import {evaluateFixture,fixtureFrames} from "../../src/engine/replay/synthetic.mjs";
const attempt=id=>({measurement:evaluateFixture(id),frames:fixtureFrames(id)});
test("aligns only comparable attempts, preserves frame amplitudes",()=>{const a=attempt("block-base"),b=attempt("block-next"),r=alignGhost(a,b);assert.equal(r.deltaCm,11.1);assert.equal(r.empiricalImprovementVerified,false);assert.ok(r.current.frames.some(f=>f.timestampMs===0));assert.deepEqual(r.current.frames[10].landmarks,b.frames[10].landmarks);assert.equal(alignGhost(a,attempt("rebound-next")),null);assert.equal(alignGhost(a,attempt("feet-cut")),null)});
