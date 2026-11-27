"use client";
import {useEffect,useRef,useState} from "react";
import {fixtureFrames} from "@/engine/replay/synthetic.mjs";
import {evaluateJump} from "@/engine/protocols/jump.mjs";
import {decodeClip,inferBuffered} from "@/engine/pose/frame-buffer";
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
// Browser-encoded synthetic clip, no camera access. Recording timing is observed,
// not asserted to be the mathematical generator's exact reference timeline.
async function encodeClip(canvas:HTMLCanvasElement,frames:PoseFrame[]){
 if(!canvas.captureStream||typeof MediaRecorder==="undefined")throw Error("BROWSER_ENCODER_UNAVAILABLE");
 const stream=canvas.captureStream(30);
 const type=["video/webm;codecs=vp8","video/webm","video/mp4"].find(t=>MediaRecorder.isTypeSupported(t));
 let recorder:MediaRecorder;
 try{recorder=new MediaRecorder(stream,type?{mimeType:type,videoBitsPerSecond:1_000_000}:undefined)}catch(e){stream.getTracks().forEach(t=>t.stop());throw e}
 const chunks:Blob[]=[];
 try{
  const ended=new Promise<Blob>((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType}));recorder.onerror=()=>reject(Error("ENCODER_FAILED"))});
  render(canvas,frames[0]);recorder.start();
  for(const f of frames){render(canvas,f);await new Promise<void>(r=>setTimeout(r,1000/30))}
  recorder.stop();
  const clip=await ended;if(!clip.size)throw Error("EMPTY_CLIP");return clip;
 }finally{if(recorder.state!=="inactive")recorder.stop();stream.getTracks().forEach(t=>t.stop())}
}
export default function SyntheticInference(){
 const canvas=useRef<HTMLCanvasElement>(null),video=useRef<HTMLVideoElement>(null),running=useRef(false),controller=useRef<AbortController|null>(null);
 const [busy,setBusy]=useState(false),[summary,setSummary]=useState(""),[result,setResult]=useState<Measurement|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function run(){
 if(running.current||!canvas.current||!video.current)return;running.current=true;setBusy(true);setSummary("Gerando clipe sintético…");setResult(null);
 const abort=new AbortController();controller.current=abort;let url:string|null=null;
 const v=video.current,c=canvas.current;
 try{
 const clip=await encodeClip(c,fixtureFrames("block-next") as PoseFrame[]);if(abort.signal.aborted)return;
 url=URL.createObjectURL(clip);v.src=url;v.muted=true;v.playsInline=true;
 setSummary("Decodificando quadros antes da inferência…");const decoded=await decodeClip(v,abort.signal);
 setSummary("Carregando modelo real…");let detected=0;
 const out=await inferBuffered(decoded,abort.signal,(frame,i,total,source)=>{
 if(frame.athleteCount===1)detected++;
 const ctx=c.getContext("2d");if(ctx){ctx.drawImage(source,0,0,c.width,c.height);ctx.fillStyle="#c6f432";for(const p of Object.values(frame.landmarks))if(p.confidence>=.5){ctx.beginPath();ctx.arc(p.x*c.width,p.y*c.height,3,0,Math.PI*2);ctx.fill()}}
 setSummary("Processando "+i+"/"+total+" quadros");
 });
 if(abort.signal.aborted)return;
 const m=evaluateJump(out.frames,"volleyball",{source:"synthetic_video"}) as Measurement;setResult(m);
 setSummary(detected+"/"+out.frames.length+" quadros com uma pose · "+(out.inferenceMs/out.frames.length).toFixed(1)+" ms/quadro de inferência (este navegador).");
 }catch{if(!abort.signal.aborted)setSummary("Falha de codificação, modelo ou inferência. Nenhum resultado foi simulado.");}finally{v.pause();v.removeAttribute("src");v.load();if(url)URL.revokeObjectURL(url);running.current=false;controller.current=null;setBusy(false)}
 }
 return <section className="panel"><h2>Experimento de inferência</h2><p>Vídeo sintético decodificado primeiro, depois processado quadro a quadro pelo modelo. Timestamps de mídia preservados; sem câmera ou envio de vídeo. Resultado experimental, não entra no ranking.</p><video ref={video} muted playsInline hidden/><canvas ref={canvas} width={360} height={480} style={{width:"100%",maxWidth:360,background:"#101f32"}} aria-label="Quadros de personagem sintético"/><button className="button secondary" onClick={run} disabled={busy}>{busy?"Executando modelo…":"Testar inferência em personagem sintético"}</button>{busy&&<button className="button secondary" onClick={()=>{controller.current?.abort();setSummary("Cancelado")}}>Cancelar inferência</button>}<p role="status" data-testid="model-summary">{summary}</p>{result&&<p data-testid="model-result">Resultado {result.status} · {result.value??"—"} {result.value!==null?"cm":""} · {result.qualityFlags.join(", ")}</p>}</section>
}
