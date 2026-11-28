import {evaluateJump,makeJumpFrames,VERSION,flightHeightCm} from "../protocols/jump.mjs";
export {flightHeightCm};
export const FIXTURES = [
  {
    "id": "block-base",
    "sport": "volleyball",
    "title": "Bloqueio · primeira tentativa",
    "durationMs": 400,
    "valid": true
  },
  {
    "id": "block-next",
    "sport": "volleyball",
    "title": "Bloqueio · segunda tentativa",
    "durationMs": 500,
    "valid": true
  },
  {
    "id": "rebound-base",
    "sport": "basketball",
    "title": "Rebote · primeira tentativa",
    "durationMs": 433.333333,
    "valid": true
  },
  {
    "id": "rebound-next",
    "sport": "basketball",
    "title": "Rebote · segunda tentativa",
    "durationMs": 533.333333,
    "valid": true
  },
  {
    "id": "feet-cut",
    "sport": "volleyball",
    "title": "Caso inválido · pés fora do quadro",
    "durationMs": 400,
    "valid": false
  }
];
export function evaluateFixture(id){
 const f=FIXTURES.find(x=>x.id===id);if(!f)throw Error("INVALID_FIXTURE");
 return evaluateJump(fixtureFrames(id),f.sport,{source:"synthetic_pose_replay",normalizedUnitsPerMeter:.42});
}

export function validateRequest(body){return !!body&&typeof body==="object"&&!Array.isArray(body)&&Object.keys(body).sort().join(",")==="fixtureId,idempotencyKey"&&typeof body.fixtureId==="string"&&FIXTURES.some(f=>f.id===body.fixtureId)&&typeof body.idempotencyKey==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.idempotencyKey);}

export function bestMarks(attempts,sport){return attempts.filter(a=>a.rankingEligible&&a.measurement.status==="accepted"&&a.measurement.sport===sport&&a.measurement.protocolId===(sport==="volleyball"?"standing-block":"standing-rebound")&&a.measurement.protocolVersion==="1.1-draft"&&a.measurement.algorithmVersion===VERSION&&Number.isFinite(a.measurement.value)).sort((a,b)=>b.measurement.value-a.measurement.value||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));}

export function fixtureFrames(id){const f=FIXTURES.find(x=>x.id===id);if(!f)throw Error("INVALID_FIXTURE");return makeJumpFrames({durationMs:f.durationMs,invalid:f.valid?null:"feet-cut"});}

export function demoLeaderboard(attempts,sport){
 const durations=sport==="volleyball"?[450,480,560]:[460,510,590];
 const entries=durations.map((t,i)=>({id:"fictional-"+i,name:["Atleta fictício A","Atleta fictício B","Atleta fictício C"][i],value:Math.round(flightHeightCm(t)*10)/10,isYou:false}));
 const best=bestMarks(attempts,sport)[0];
 if(best)entries.push({id:"you",name:"Você (demo)",value:best.measurement.value,isYou:true});
 return entries.sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id)).map((e,i)=>({...e,position:i+1}));
}
