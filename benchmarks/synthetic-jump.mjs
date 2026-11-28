import {evaluateJump,makeJumpFrames,flightHeightCm,VERSION} from "../src/engine/protocols/jump.mjs";
const rows=[];
for(const fps of [30,60,120])for(const durationMs of [300,400,450,500,550,600])for(const jitter of [0,1]){
 const frames=makeJumpFrames({fps,durationMs,jitter});
 const start=performance.now(),r=evaluateJump(frames,"volleyball",{source:"synthetic_pose_replay",normalizedUnitsPerMeter:.42});
 rows.push({fps,durationMs,jitter,status:r.status,value:r.value,reference:flightHeightCm(durationMs),latencyMs:performance.now()-start,flags:r.qualityFlags});
}
const groups=[30,60,120].map(fps=>{const a=rows.filter(r=>r.fps===fps),b=a.filter(r=>r.status==="accepted"),err=b.map(r=>r.value-r.reference),mean=xs=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:null;return {fps,n:a.length,accepted:b.length,experimental:a.filter(r=>r.status==="experimental").length,rejected:a.filter(r=>r.status==="rejected").length,mae:mean(err.map(Math.abs)),rmse:err.length?Math.sqrt(mean(err.map(x=>x*x))):null,bias:mean(err),medianAbs:err.length?(()=>{const e=err.map(Math.abs).sort((x,y)=>x-y);return (e[Math.floor((e.length-1)/2)]+e[Math.floor(e.length/2)])/2})():null,meanEngineMs:mean(a.map(r=>r.latencyMs))}});
const invalid=["feet-cut","multiple","empty","no-jump","double","duplicate","gap","estimated","low-confidence","camera-drift"].map(invalid=>{const r=evaluateJump(makeJumpFrames({invalid}),"volleyball",{source:"synthetic_pose_replay",normalizedUnitsPerMeter:.42});return {invalid,status:r.status,flags:r.qualityFlags}});
console.log(JSON.stringify({version:VERSION,kind:"synthetic_math_only",node:process.version,platform:process.platform,arch:process.arch,groups,invalid,rows},null,2));
if(invalid.some(r=>r.status==="accepted")||groups.some(g=>g.accepted!==g.n))process.exitCode=1;
