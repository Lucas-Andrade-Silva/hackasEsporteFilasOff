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
export function flightHeightCm(ms){if(!Number.isFinite(ms)||ms<=0||ms>1200)throw new RangeError("invalid flight duration");return 9.81*(ms/1000)**2/8*100;}

export function evaluateFixture(id){
 const f=FIXTURES.find(x=>x.id===id);
 if(!f)throw new Error("INVALID_FIXTURE");
 const takeoff=300,landing=takeoff+f.durationMs;
 return {protocolId:f.sport==="volleyball"?"standing-block":"standing-rebound",protocolVersion:"1.0-draft",algorithmVersion:"synthetic-flight-0.1",sport:f.sport,metric:"jump_height",unit:"cm",value:f.valid?Math.round(flightHeightCm(f.durationMs)*10)/10:null,uncertainty:null,uncertaintyMethod:null,status:f.valid?"accepted":"rejected",effectiveFps:30,qualityFlags:f.valid?["SYNTHETIC_ANNOTATED_EVENTS","NO_EMPIRICAL_CALIBRATION"]:["FEET_OUT_OF_FRAME","SYNTHETIC_ANNOTATED_EVENTS"],events:f.valid?[{name:"takeoff",timestampMs:takeoff},{name:"apex",timestampMs:takeoff+f.durationMs/2},{name:"landing",timestampMs:landing}]:[]};
}

export function validateRequest(body){return !!body&&typeof body==="object"&&!Array.isArray(body)&&Object.keys(body).sort().join(",")==="fixtureId,idempotencyKey"&&typeof body.fixtureId==="string"&&FIXTURES.some(f=>f.id===body.fixtureId)&&typeof body.idempotencyKey==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.idempotencyKey);}

export function bestMarks(attempts,sport){return attempts.filter(a=>a.rankingEligible&&a.measurement.status==="accepted"&&a.measurement.sport===sport&&a.measurement.protocolId===(sport==="volleyball"?"standing-block":"standing-rebound")&&a.measurement.protocolVersion==="1.0-draft"&&a.measurement.algorithmVersion==="synthetic-flight-0.1"&&Number.isFinite(a.measurement.value)).sort((a,b)=>b.measurement.value-a.measurement.value||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));}
