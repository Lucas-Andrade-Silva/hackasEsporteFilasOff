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
 const canvas=useRef<HTMLCanvasElement>(null),video=useRef<HTMLVideoElement>(null),running=useRef(false);
 const [busy,setBusy]=useState(false),[summary,setSummary]=useState(""),[result,setResult]=useState<Measurement|null>(null);
 async function run(){
 if(running.current||!canvas.current||!video.current)return;running.current=true;setBusy(true);setSummary("Gerando clipe sintético…");setResult(null);
 let model:Awaited<ReturnType<typeof createPoseModel>>|null=null,url:string|null=null;
 const v=video.current,c=canvas.current;
 try{
 const clip=await encodeClip(c,fixtureFrames("block-next") as PoseFrame[]);
 url=URL.createObjectURL(clip);v.src=url;v.muted=true;v.playsInline=true;
 setSummary("Carregando modelo real…");model=await createPoseModel();const pose=model,out:PoseFrame[]=[];let detected=0,elapsed=0,last=-1;
 await new Promise<void>((resolve,reject)=>{
  let settled=false,handle=0,timeout:ReturnType<typeof setTimeout>;
  const finish=(err?:Error)=>{if(settled)return;settled=true;clearTimeout(timeout);v.removeEventListener("ended",ended);v.removeEventListener("error",failed);v.cancelVideoFrameCallback(handle);v.pause();err?reject(err):resolve()};
  const ended=()=>finish(),failed=()=>finish(Error("VIDEO_DECODE_FAILED"));
  timeout=setTimeout(()=>finish(Error("VIDEO_TIMEOUT")),20000);
  if(!v.requestVideoFrameCallback||!v.cancelVideoFrameCallback){clearTimeout(timeout);reject(Error("VIDEO_CALLBACK_UNAVAILABLE"));return}
  const next:VideoFrameRequestCallback=(_now,meta)=>{
   if(settled)return;
   try{
    if(meta.mediaTime>last){last=meta.mediaTime;const start=performance.now(),r=pose.detectForVideo(v,meta.mediaTime*1000);elapsed+=performance.now()-start;out.push(adaptPose(r.landmarks,meta.mediaTime*1000,v.videoWidth,v.videoHeight));if(r.landmarks.length===1)detected++;
     const ctx=c.getContext("2d");if(ctx){ctx.drawImage(v,0,0,c.width,c.height);if(r.landmarks.length===1){ctx.fillStyle="#c6f432";for(const i of Object.keys(NAMES)){const p=r.landmarks[0][Number(i)];if(p&&(p.visibility??0)>=.5){ctx.beginPath();ctx.arc(p.x*c.width,p.y*c.height,3,0,Math.PI*2);ctx.fill()}}}}
     setSummary(detected+"/"+out.length+" quadros com uma pose detectada");
    }
    handle=v.requestVideoFrameCallback(next);
   }catch{finish(Error("INFERENCE_FAILED"))}
  };
  v.addEventListener("ended",ended);v.addEventListener("error",failed);handle=v.requestVideoFrameCallback(next);v.play().catch(()=>finish(Error("PLAYBACK_FAILED")));
 });
 if(!out.length)throw Error("NO_DECODED_FRAMES");
 const m=evaluateJump(out,"volleyball",{source:"synthetic_video"}) as Measurement;setResult(m);setSummary(detected+"/"+out.length+" quadros com uma pose · "+(elapsed/out.length).toFixed(1)+" ms/quadro de inferência (este navegador).");
 }catch{setSummary("Falha de codificação, modelo ou inferência. Nenhum resultado foi simulado.");}finally{model?.close();v.pause();v.removeAttribute("src");v.load();if(url)URL.revokeObjectURL(url);running.current=false;setBusy(false)}
 }
 return <section className="panel"><h2>Experimento de inferência</h2><p>Personagem 2D gerado no navegador, codificado em vídeo local e decodificado pelo navegador, sem pessoas reais. MediaPipe recebe pixels do vídeo, não os landmarks do gerador. A taxa de detecção depende do modelo; não pontua.</p><video ref={video} muted playsInline hidden/><canvas ref={canvas} width={360} height={480} style={{width:"100%",maxWidth:360,background:"#101f32"}} aria-label="Quadros de personagem sintético"/><button className="button secondary" onClick={run} disabled={busy}>{busy?"Executando modelo…":"Testar inferência em personagem sintético"}</button><p role="status" data-testid="model-summary">{summary}</p>{result&&<p data-testid="model-result">Resultado {result.status} · {result.value??"—"} {result.value!==null?"cm":""} · {result.qualityFlags.join(", ")}</p>}</section>
}
