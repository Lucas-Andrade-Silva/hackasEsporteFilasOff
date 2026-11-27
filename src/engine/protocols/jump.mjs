// Shared deterministic protocol. Synthetic acceptance is not empirical validation.
export const VERSION="jump-0.2.0";
const FOOT=["left_heel","right_heel","left_foot_index","right_foot_index"],CORE=["left_heel","right_heel","left_foot_index","right_foot_index","left_ankle","right_ankle","left_hip","right_hip","left_shoulder","right_shoulder","nose"];
const median=a=>{const b=[...a].sort((x,y)=>x-y);return b.length?(b[Math.floor((b.length-1)/2)]+b[Math.floor(b.length/2)])/2:NaN};
const round=(x,n=1)=>Math.round(x*10**n)/10**n;
export function flightHeightCm(ms){if(!Number.isFinite(ms)||ms<=0||ms>1200)throw RangeError("invalid flight duration");return 9.81*(ms/1000)**2/8*100}

export function fitQuadratic(points){
 if(points.length<5)return null;
 const t0=points[0].t;
 const rows=points.map(p=>({t:(p.t-t0)/1000,y:p.y}));
 const m=Array.from({length:3},(_,i)=>Array.from({length:4},(_,j)=>rows.reduce((s,p)=>s+(j===3?p.y*p.t**i:p.t**(i+j)),0)));
 for(let i=0;i<3;i++){let k=i;for(let j=i+1;j<3;j++)if(Math.abs(m[j][i])>Math.abs(m[k][i]))k=j;[m[i],m[k]]=[m[k],m[i]];if(Math.abs(m[i][i])<1e-12)return null;const v=m[i][i];for(let j=i;j<4;j++)m[i][j]/=v;for(let k=0;k<3;k++)if(k!==i){const v=m[k][i];for(let j=i;j<4;j++)m[k][j]-=v*m[i][j]}}
 const [c,b,a]=m.map(r=>r[3]);const predict=t=>a*t*t+b*t+c;
 const mean=rows.reduce((s,p)=>s+p.y,0)/rows.length;
 const ss=rows.reduce((s,p)=>s+(p.y-predict(p.t))**2,0),total=rows.reduce((s,p)=>s+(p.y-mean)**2,0);
 return {a,b,c,t0,rmse:Math.sqrt(ss/rows.length),r2:total>1e-12?1-ss/total:0,apexMs:t0-1000*b/(2*a)};
}

// Median of three observed points for apex selection only. Raw contact evidence and fit are unchanged.
export function smoothObservedHip(points){
 return points.map((p,i)=>{const prev=points[i-1],next=points[i+1];return prev&&next&&p.t-prev.t<80&&next.t-p.t<80?{...p,hip:median([prev.hip,p.hip,next.hip])}:{...p}});
}

export function evaluateJump(frames,sport,options={}){
 const synthetic=options.source==="synthetic_pose_replay";
 const flags=[],events=[];
 const result={protocolId:sport==="basketball"?"standing-rebound":"standing-block",protocolVersion:"1.1-draft",algorithmVersion:VERSION,sport,metric:"jump_height",unit:"cm",value:null,uncertainty:null,uncertaintyMethod:null,status:"rejected",effectiveFps:null,qualityFlags:flags,events,diagnostics:null};
 const reject=flag=>{if(flag)flags.push(flag);return result};
 if(!["volleyball","basketball"].includes(sport)||!Array.isArray(frames)||frames.length<10||frames.length>1200)return reject("INVALID_SEQUENCE");
 const gaps=[];for(let i=0;i<frames.length;i++){const f=frames[i];if(!f||!Number.isFinite(f.timestampMs)||!Number.isInteger(f.width)||!Number.isInteger(f.height)||f.width<=0||f.height<=0||!Number.isInteger(f.athleteCount)||!f.landmarks)return reject("INVALID_FRAME");if(i){const d=f.timestampMs-frames[i-1].timestampMs;if(!(d>0))return reject("INVALID_TIMESTAMP");gaps.push(d)}}
 const step=median(gaps),fps=1000/step;result.effectiveFps=round(fps);
 if(frames.at(-1).timestampMs-frames[0].timestampMs>12000)return reject("CLIP_TOO_LONG");
 if(frames.some(f=>f.athleteCount>1))return reject("MULTIPLE_ATHLETES");
 if(frames.some(f=>f.width!==frames[0].width||f.height!==frames[0].height))return reject("FRAME_GEOMETRY_CHANGED");
 if(fps<15||Math.max(...gaps)>150)return reject("INSUFFICIENT_TIMING");
 if(fps<28||Math.max(...gaps)>1.8*step)flags.push("LOW_OR_IRREGULAR_FPS");
 const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=.01&&p.x<=.99&&p.y>=.01&&p.y<=.99&&Number.isFinite(p.confidence)&&p.confidence>=.5&&p.estimated===false;
 const data=frames.map(f=>{if(f.athleteCount!==1||!CORE.every(k=>valid(f.landmarks[k])))return null;const p=f.landmarks;return {t:f.timestampMs,feet:FOOT.map(k=>p[k].y),hip:(p.left_hip.y+p.right_hip.y)/2,x:(p.left_hip.x+p.right_hip.x)/2,span:Math.abs((p.left_hip.y+p.right_hip.y-p.left_shoulder.y-p.right_shoulder.y)/2)}});
 if(data.some(p=>p===null))return reject("MISSING_OR_ESTIMATED_CRITICAL_LANDMARKS");
 const start=data.filter(p=>p.t-data[0].t<=100),end=data.filter(p=>data.at(-1).t-p.t<=100);
 if(start.length<2||end.length<2||data.at(-1).t-data[0].t<500)return reject("MISSING_STABLE_WINDOWS");
 const floor=FOOT.map((_,i)=>median(start.map(p=>p.feet[i])));
 const footDisplacement=data.map(p=>Math.min(...p.feet.map((y,i)=>floor[i]-y)));
 const span=median(start.map(p=>p.span));if(span<.035)return reject("BODY_TOO_SMALL");
 const threshold=Math.max(.004,span*.018);
 if(start.some(p=>p.feet.some((y,i)=>Math.abs(y-floor[i])>threshold))||end.some(p=>p.feet.some((y,i)=>Math.abs(y-floor[i])>threshold*2)))return reject("UNSTABLE_CONTACT");
 const runs=[];let s=-1;for(let i=0;i<data.length;i++){if(footDisplacement[i]>threshold){if(s<0)s=i}else if(s>=0){if(i-s>=2)runs.push([s,i-1]);s=-1}}if(s>=0)return reject("LANDING_NOT_OBSERVED");
 if(!runs.length)return reject("NO_JUMP");
 if(runs.length!==1)return reject("MULTIPLE_JUMPS");
 const [first,last]=runs[0];if(first<2||last+2>=data.length)return reject("MISSING_CONTACT_WINDOWS");
 // Outer contact bracket: conservative interval, not an exact contact event.
 const takeoff=data[first-1].t,landing=data[last+1].t,duration=landing-takeoff;
 if(duration<180||duration>1000)return reject("FLIGHT_DURATION_OUT_OF_PROTOCOL");
 const airborne=data.slice(first,last+1);
 const smooth=smoothObservedHip(airborne),apex=smooth.reduce((a,p)=>p.hip<a.hip?p:a);
 if(apex.t===airborne[0].t||apex.t===airborne.at(-1).t)flags.push("APEX_UNCERTAIN");
 const fit=fitQuadratic(airborne.map(p=>({t:p.t,y:p.hip})));
 const nominal=flightHeightCm(duration);
 const innerDuration=data[last].t-data[first].t;
 const lower=innerDuration>0?flightHeightCm(innerDuration):0;
 const cameraProxy=Math.max(...data.map(p=>p.x))-Math.min(...data.map(p=>p.x));
 const spans=data.map(p=>p.span);
 if(cameraProxy>.09||Math.max(...spans)-Math.min(...spans)>span*.45)flags.push("PERSPECTIVE_OR_BODY_CHANGE");
 if(!fit||fit.a<=0||fit.r2<.85||fit.apexMs<takeoff||fit.apexMs>landing)flags.push("TRAJECTORY_FIT_UNRELIABLE");
 let complementary=null;
 // Scale is supplied ONLY by the synthetic generator. Never derive scale from gravity to verify gravity.
 if(synthetic&&Number.isFinite(options.normalizedUnitsPerMeter)&&options.normalizedUnitsPerMeter>0&&fit&&fit.a>0&&fit.apexMs>=takeoff&&fit.apexMs<=landing){
 const at=t=>{const x=(t-fit.t0)/1000;return fit.a*x*x+fit.b*x+fit.c};
 complementary=100*((at(takeoff)+at(landing))/2-at(fit.apexMs))/options.normalizedUnitsPerMeter;
 if(Math.abs(complementary-nominal)>Math.max(5,nominal*.25))flags.push("ESTIMATORS_DIVERGE");
 }else flags.push("NO_INDEPENDENT_SPATIAL_SCALE");
 if(!synthetic)flags.push(options.source==="synthetic_video"?"UNVALIDATED_SYNTHETIC_VIDEO":"UNVALIDATED_REAL_CAPTURE","CAMERA_MOTION_NOT_INDEPENDENTLY_VERIFIED");
 flags.push("NO_EMPIRICAL_CALIBRATION");
 result.value=round(nominal);events.push({name:"takeoff",timestampMs:takeoff},{name:"apex",timestampMs:apex.t},{name:"landing",timestampMs:landing});
 result.diagnostics={flightDurationMs:round(duration,2),timingBracketCm:[round(lower,2),round(nominal,2)],parabolaHeightCm:complementary===null?null:round(complementary,2),fitR2:fit?round(fit.r2,4):null,fitRmseNormalized:fit?round(fit.rmse,5):null,contactMethod:"outer-sampled-contact-bracket",sampleCount:frames.length};
 result.status=synthetic&&!flags.some(f=>["LOW_OR_IRREGULAR_FPS","APEX_UNCERTAIN","PERSPECTIVE_OR_BODY_CHANGE","TRAJECTORY_FIT_UNRELIABLE","ESTIMATORS_DIVERGE","NO_INDEPENDENT_SPATIAL_SCALE"].includes(f))?"accepted":"experimental";
 return result;
}

export function makeJumpFrames({durationMs=500,fps=30,invalid=null,jitter=0}={}){
 const base={nose:[.5,.30],left_shoulder:[.44,.38],right_shoulder:[.56,.38],left_elbow:[.39,.30],right_elbow:[.61,.30],left_wrist:[.35,.20],right_wrist:[.65,.20],left_hip:[.46,.56],right_hip:[.54,.56],left_knee:[.43,.72],right_knee:[.57,.72],left_ankle:[.42,.88],right_ankle:[.58,.88],left_heel:[.41,.89],right_heel:[.59,.89],left_foot_index:[.45,.9],right_foot_index:[.55,.9]};
 const takeoff=300,end=invalid==="double"?300+2*durationMs+600:300+durationMs+300,frames=[];
 for(let i=0;i<=Math.ceil(end/1000*fps);i++){
 const t=i*1000/fps+(i%2?jitter:0),T=durationMs/1000;
 let e=(t-takeoff)/1000;if(invalid==="double"&&t>takeoff+durationMs+200)e=(t-takeoff-durationMs-200)/1000;
 const d=invalid==="no-jump"?0:e>0&&e<T?4.905*e*(T-e):0;
 const crouch=t>100&&t<300?.018*Math.sin(Math.PI*(t-100)/200):0;
 const landmarks={};for(const [k,[x,y]] of Object.entries(base)){
 const foot=/(ankle|heel|foot_index)/.test(k);if(invalid==="feet-cut"&&foot)continue;
 landmarks[k]={x:x+(invalid==="camera-drift"?.13*t/end:0),y:y-d*.42+(foot?0:crouch),confidence:invalid==="low-confidence"&&t>300&&t<500&&foot?.2:1,estimated:invalid==="estimated"&&t>300&&t<500&&foot};
 }
 frames.push({timestampMs:t,width:280,height:210,athleteCount:invalid==="multiple"&&i===10?2:invalid==="empty"?0:1,landmarks});
 }
 if(invalid==="duplicate")frames[8].timestampMs=frames[7].timestampMs;
 if(invalid==="gap")for(let i=8;i<frames.length;i++)frames[i].timestampMs+=200;
 return frames;
}
