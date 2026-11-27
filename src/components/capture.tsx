"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import type {PoseLandmarker} from "@mediapipe/tasks-vision";
import {evaluateJump} from "@/engine/protocols/jump.mjs";
import type {Measurement,Sport} from "@/contracts/attempt";
import {createPoseModel} from "@/engine/pose/mediapipe-adapter";
import {snapshot,inferBuffered,type PixelFrame} from "@/engine/pose/frame-buffer";
const edges=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[27,29],[29,31],[24,26],[26,28],[28,30],[30,32]];
export default function Capture({sport}:{sport:Sport}){
 const video=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null);
 const stream=useRef<MediaStream|null>(null),model=useRef<PoseLandmarker|null>(null),raf=useRef(0),generation=useRef(0),frames=useRef<PixelFrame[]>([]),bufferCanvas=useRef<HTMLCanvasElement|null>(null),processing=useRef<AbortController|null>(null),recording=useRef(false),started=useRef(0),countdownEnd=useRef(0);
 const [measurement,setMeasurement]=useState<Measurement|null>(null);
 const [consent,setConsent]=useState(false),[phase,setPhase]=useState<"idle"|"loading"|"ready"|"countdown"|"recording"|"processing"|"done">("idle"),[message,setMessage]=useState(""),[count,setCount]=useState(3),[seen,setSeen]=useState(0),[frameCount,setFrameCount]=useState(0);
 function stop(){processing.current?.abort();generation.current++;cancelAnimationFrame(raf.current);recording.current=false;countdownEnd.current=0;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;model.current?.close();model.current=null;if(video.current)video.current.srcObject=null;}
 useEffect(()=>()=>{stop();frames.current=[]},[]);
 async function start(){
  stop();const g=generation.current;frames.current=[];setMessage("");setMeasurement(null);setPhase("loading");
  let acquired:MediaStream|null=null;let pose:PoseLandmarker|null=null;
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw Error("Câmera indisponível. Use HTTPS ou a demo.");
    acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},audio:false});
    if(g!==generation.current){acquired.getTracks().forEach(t=>t.stop());return}
    stream.current=acquired;
    if(!video.current)throw Error("Câmera indisponível.");
    video.current.srcObject=acquired;await video.current.play();
    pose=await createPoseModel();
    if(g!==generation.current){pose.close();return}
    model.current=pose;setPhase("ready");let last=-1;
    const loop=()=>{
      if(g!==generation.current)return;
      const v=video.current,c=canvas.current,p=model.current;
      const now=performance.now();
      if(countdownEnd.current){
        const n=Math.ceil((countdownEnd.current-now)/1000);
        if(n>0)setCount(n);else{countdownEnd.current=0;recording.current=true;started.current=now;frames.current=[];setPhase("recording")}
      }
      if(recording.current&&now-started.current>=5000){
        const buffered=frames.current;frames.current=[];setFrameCount(buffered.length);stop();const job=new AbortController();processing.current=job;setPhase("processing");
        void inferBuffered(buffered,job.signal).then(out=>{if(!job.signal.aborted){setMeasurement(evaluateJump(out.frames,sport,{source:"authorized_capture"}) as Measurement);setPhase("done")}}).catch(()=>{if(!job.signal.aborted){setMessage("Não foi possível processar os quadros. Tente novamente.");setPhase("idle")}}).finally(()=>{buffered.length=0;if(processing.current===job)processing.current=null});return
      }
      if(v&&c&&p&&v.readyState>=2&&v.currentTime!==last){
        last=v.currentTime;
        try{
          if(recording.current){bufferCanvas.current??=document.createElement("canvas");snapshot(v,bufferCanvas.current,v.currentTime*1000,frames.current);raf.current=requestAnimationFrame(loop);return}
          const result=p.detectForVideo(v,now);const detected=result.landmarks.length;setSeen(detected);
          c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext("2d");
          if(ctx&&detected===1){const pts=result.landmarks[0];ctx.strokeStyle="#c6f432";ctx.fillStyle="#c6f432";ctx.lineWidth=3;for(const [i,j] of edges){const a=pts[i],b=pts[j];if((a.visibility??0)<0.5||(b.visibility??0)<0.5)continue;ctx.beginPath();ctx.moveTo(a.x*c.width,a.y*c.height);ctx.lineTo(b.x*c.width,b.y*c.height);ctx.stroke()}for(const pt of pts){if((pt.visibility??0)<0.5)continue;ctx.beginPath();ctx.arc(pt.x*c.width,pt.y*c.height,3,0,Math.PI*2);ctx.fill()}}

        }catch{stop();frames.current=[];setPhase("idle");setMessage("A inferência falhou. Tente novamente ou use a demo.");return}
      }
      raf.current=requestAnimationFrame(loop)
    };raf.current=requestAnimationFrame(loop)
  }catch(e){if(g===generation.current){stop();setPhase("idle");setMessage(e instanceof Error&&e.message.includes("HTTPS")?e.message:"Não foi possível iniciar câmera/modelo. Confira permissões, conexão e tente novamente.")}else{acquired?.getTracks().forEach(t=>t.stop());pose?.close()}}
 }
 return <><div className="eyebrow">Teste privado · {sport==="volleyball"?"Bloqueio":"Rebote"}</div><h1>Prepare o salto.</h1><div className="notice">Somente adultos, ambiente privado e espaço livre. Não enviamos vídeo ou landmarks. A medição é experimental, local e não pontua no ranking; não há calibração empírica.</div><label className="check"><input type="checkbox" checked={consent} onChange={e=>{setConsent(e.target.checked);if(!e.target.checked){stop();frames.current=[];setPhase("idle")}}}/>Tenho 18 anos ou mais, espaço seguro e autorizo o uso local da câmera.</label><div className="camera"><video ref={video} muted playsInline/><canvas ref={canvas} aria-hidden="true"/><div className="silhouette"/>{phase==="countdown"&&<div className="count" aria-live="polite">{count}</div>}</div><p role="status" className="subhead">{phase==="loading"?"Carregando câmera e modelo…":phase==="ready"?(seen===1?"✓ Uma pessoa detectada. Confira se os pés estão visíveis.":"⚠ Posicione apenas uma pessoa no quadro.") :phase==="recording"?"Capturando quadros localmente por 5 segundos…":phase==="processing"?"Processando quadros após captura…":phase==="done"?frameCount+" quadros processados localmente; resultado não elegível ao ranking.":"Apoie o celular e deixe todo o corpo visível."}</p>{measurement&&<section className="panel"><span className="badge">{measurement.status==="rejected"?"Rejeitado":"Experimental · sem ranking"}</span><div className="metric">{measurement.value===null?"—":measurement.value.toLocaleString("pt-BR")} {measurement.value!==null&&<small>cm</small>}</div><p>Incerteza empírica pendente · {measurement.effectiveFps??"—"} FPS efetivos.</p><p>Motivos: {measurement.qualityFlags.join(" · ")}</p></section>}{message&&<p className="notice error" role="alert">{message}</p>}<div className="stack">{(phase==="idle"||phase==="done")&&<button className="button" disabled={!consent} onClick={start}>Ativar câmera</button>}{phase==="ready"&&<button className="button" disabled={seen!==1} onClick={()=>{setCount(3);countdownEnd.current=performance.now()+3000;setPhase("countdown")}}>Começar contagem</button>}{!["idle","done"].includes(phase)&&<button className="button secondary" onClick={()=>{stop();frames.current=[];setPhase("idle")}}>Cancelar e desligar câmera</button>}<Link className="button secondary" href="/demo">Experimentar demo sintética</Link></div></>
}
