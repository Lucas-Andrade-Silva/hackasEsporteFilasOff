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

export function fixtureFrames(fixtureId){
 const f=FIXTURES.find(x=>x.id===fixtureId);if(!f)throw Error("INVALID_FIXTURE");
 const base={nose:[.5,.30],left_shoulder:[.44,.38],right_shoulder:[.56,.38],left_elbow:[.39,.30],right_elbow:[.61,.30],left_wrist:[.35,.20],right_wrist:[.65,.20],left_hip:[.46,.56],right_hip:[.54,.56],left_knee:[.43,.72],right_knee:[.57,.72],left_ankle:[.42,.88],right_ankle:[.58,.88],left_heel:[.41,.89],right_heel:[.59,.89],left_foot_index:[.45,.9],right_foot_index:[.55,.9]};
 const end=300+f.durationMs+300,frames=[];
 for(let i=0;i<=Math.ceil(end/1000*30);i++){
  const t=i*1000/30,elapsed=Math.max(0,Math.min(f.durationMs,t-300))/1000,T=f.durationMs/1000,displacement=4.905*elapsed*(T-elapsed);
  const crouch=t<300 ? .025*Math.sin(Math.PI*t/300) : 0;
  const landmarks={};for(const [name,[x,y]] of Object.entries(base)){
   if(!f.valid&&/(ankle|heel|foot_index)/.test(name))continue;
   landmarks[name]={x,y:y-displacement*.42+crouch,confidence:1,estimated:false};
  }
  frames.push({timestampMs:t,width:280,height:210,athleteCount:1,landmarks});
 }return frames;
}

export function demoLeaderboard(attempts,sport){
 const durations=sport==="volleyball"?[450,480,560]:[460,510,590];
 const entries=durations.map((t,i)=>({id:"fictional-"+i,name:["Atleta fictício A","Atleta fictício B","Atleta fictício C"][i],value:Math.round(flightHeightCm(t)*10)/10,isYou:false}));
 const best=bestMarks(attempts,sport)[0];
 if(best)entries.push({id:"you",name:"Você (demo)",value:best.measurement.value,isYou:true});
 return entries.sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id)).map((e,i)=>({...e,position:i+1}));
}
