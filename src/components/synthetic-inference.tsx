"use client";
import {useRef,useState} from "react";
import {fixtureFrames} from "@/engine/replay/synthetic.mjs";
import {evaluateJump} from "@/engine/protocols/jump.mjs";
import {adaptPose,createPoseModel,NAMES} from "@/engine/pose/mediapipe-adapter";
import type {PoseFrame,Measurement} from "@/contracts/attempt";
type P={x:number;y:number};
function render(c:HTMLCanvasElement,f:PoseFrame){
 const ctx=c.getContext("2d");if(!ctx)return;const w=c.width,h=c.height;
 ctx.fillStyle="#e4daca";ctx.fillRect(0,0,w,h);ctx.fillStyle="#5b7083";ctx.fillRect(0,h*.93,w,h*.07);
 const p=(k:string):P=>({x:f.landmarks[k].x*w,y:f.landmarks[k].y*h});
 const line=(a:string,b:string,color:string,width:number)=>{const x=p(a),y=p(b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(x.x,x.y);ctx.lineTo(y.x,y.y);ctx.stroke()};
 const skin="#bc8c68",shirt="#245f96",shorts="#24364b";
 for(const side of ["left","right"]){line(side+"_hip",side+"_knee",shorts,w*.075);line(side+"_knee",side+"_ankle",skin,w*.048);line(side+"_heel",side+"_foot_index","#f5f4ef",w*.05);line(side+"_shoulder",side+"_elbow",skin,w*.045);line(side+"_elbow",side+"_wrist",skin,w*.04)}
 ctx.fillStyle=shirt;ctx.beginPath();for(const [i,k] of ["left_shoulder","right_shoulder","right_hip","left_hip"].entries()){const a=p(k);if(i===0)ctx.moveTo(a.x,a.y);else ctx.lineTo(a.x,a.y)}ctx.closePath();ctx.fill();
 const n=p("nose");ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(n.x,n.y-h*.028,w*.045,h*.055,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#352820";ctx.beginPath();ctx.ellipse(n.x,n.y-h*.061,w*.047,h*.025,0,Math.PI,2*Math.PI);ctx.fill();ctx.fillStyle="#202020";for(const x of [-.015,.015]){ctx.beginPath();ctx.arc(n.x+x*w,n.y-h*.032,w*.004,0,Math.PI*2);ctx.fill()}
}
export default function SyntheticInference(){
 const canvas=useRef<HTMLCanvasElement>(null),running=useRef(false);
 const [busy,setBusy]=useState(false),[summary,setSummary]=useState(""),[result,setResult]=useState<Measurement|null>(null);
 async function run(){
 if(running.current||!canvas.current)return;running.current=true;setBusy(true);setSummary("Carregando modelo real…");setResult(null);
 let model:Awaited<ReturnType<typeof createPoseModel>>|null=null;
 try{
 model=await createPoseModel();const frames=fixtureFrames("block-next") as PoseFrame[],out:PoseFrame[]=[];let detected=0,elapsed=0;
 for(const f of frames){const c=canvas.current;if(!c)break;render(c,f);const start=performance.now(),r=model.detectForVideo(c,f.timestampMs);elapsed+=performance.now()-start;out.push(adaptPose(r.landmarks,f.timestampMs,c.width,c.height));if(r.landmarks.length===1)detected++;
 const ctx=c.getContext("2d");if(ctx&&r.landmarks.length===1){ctx.fillStyle="#c6f432";for(const i of Object.keys(NAMES)){const p=r.landmarks[0][Number(i)];if(p&&(p.visibility??0)>=.5){ctx.beginPath();ctx.arc(p.x*c.width,p.y*c.height,3,0,Math.PI*2);ctx.fill()}}}
 setSummary(detected+"/"+out.length+" quadros com uma pose detectada");await new Promise<void>(resolve=>setTimeout(resolve,0));}
 if(out.length){const m=evaluateJump(out,"volleyball",{source:"synthetic_video"}) as Measurement;setResult(m);setSummary(detected+"/"+out.length+" quadros com uma pose · "+(elapsed/out.length).toFixed(1)+" ms/quadros de inferência (este navegador).")}
 }catch{setSummary("Modelo indisponível ou falha de inferência. Nenhum resultado foi simulado.");}finally{model?.close();running.current=false;setBusy(false)}
 }
 return <section className="panel"><h2>Experimento de inferência</h2><p>Renderização 2D gerada no navegador, sem pessoas reais. O MediaPipe recebe pixels, não os landmarks do gerador. Não é vídeo decodificado nem garantia de detecção; não pontua.</p><canvas ref={canvas} width={360} height={480} style={{width:"100%",maxWidth:360,background:"#101f32"}} aria-label="Quadros de personagem sintético"/><button className="button secondary" onClick={run} disabled={busy}>{busy?"Executando modelo…":"Testar inferência em personagem sintético"}</button><p role="status">{summary}</p>{result&&<p>Resultado {result.status} · {result.value??"—"} {result.value!==null?"cm":""} · {result.qualityFlags.join(", ")}</p>}</section>
}
