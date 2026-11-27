// No normalization of jump amplitude; compare only same sport/protocol/version/algorithm.
export function alignGhost(first,second){
 const a=first.measurement,b=second.measurement;
 if(a.status!=="accepted"||b.status!=="accepted"||["sport","protocolId","protocolVersion","algorithmVersion"].some(k=>a[k]!==b[k]))return null;
 const align=({frames,measurement})=>{const takeoff=measurement.events.find(e=>e.name==="takeoff"),landing=measurement.events.find(e=>e.name==="landing");if(!takeoff||!landing)return null;return {flightMs:landing.timestampMs-takeoff.timestampMs,frames:frames.map(f=>({...f,timestampMs:f.timestampMs-takeoff.timestampMs}))}};
 const previous=align(first),current=align(second);
 return previous&&current?{previous,current,deltaCm:Number((b.value-a.value).toFixed(1)),empiricalImprovementVerified:false}:null;
}
