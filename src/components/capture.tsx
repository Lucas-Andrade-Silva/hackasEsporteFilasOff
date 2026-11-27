"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import type {PoseLandmarker} from "@mediapipe/tasks-vision";
import type {Sport,PoseFrame} from "@/contracts/attempt";
const names:Record<number,string>={0:"nose",11:"left_shoulder",12:"right_shoulder",13:"left_elbow",14:"right_elbow",15:"left_wrist",16:"right_wrist",23:"left_hip",24:"right_hip",25:"left_knee",26:"right_knee",27:"left_ankle",28:"right_ankle",29:"left_heel",30:"right_heel",31:"left_foot_index",32:"right_foot_index"};
const edges=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[27,29],[29,31],[24,26],[26,28],[28,30],[30,32]];
export default function Capture({sport}:{sport:Sport}){
 const video=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null);
 const stream=useRef<MediaStream|null>(null),model=useRef<PoseLandmarker|null>(null),raf=useRef(0),generation=useRef(0),frames=useRef<PoseFrame[]>([]),recording=useRef(false),started=useRef(0),countdownEnd=useRef(0);
 const [consent,setConsent]=useState(false),[phase,setPhase]=useState<"idle"|"loading"|"ready"|"countdown"|"recording"|"done">("idle"),[message,setMessage]=useState(""),[count,setCount]=useState(3),[seen,setSeen]=useState(0),[frameCount,setFrameCount]=useState(0);
 function stop(){generation.current++;cancelAnimationFrame(raf.current);recording.current=false;countdownEnd.current=0;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;model.current?.close();model.current=null;if(video.current)video.current.srcObject=null;}
 useEffect(()=>()=>{stop();frames.current=[]},[]);
 async function start(){
  stop();const g=generation.current;frames.current=[];setMessage("");setPhase("loading");
  let acquired:MediaStream|null=null;let pose:PoseLandmarker|null=null;
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw Error("Câmera indisponível. Use HTTPS ou a demo.");
    acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},audio:false});
    if(g!==generation.current){acquired.getTracks().forEach(t=>t.stop());return}
    stream.current=acquired;
    if(!video.current)throw Error("Câmera indisponível.");
    video.current.srcObject=acquired;await video.current.play();
    const {FilesetResolver,PoseLandmarker}=await import("@mediapipe/tasks-vision");
    const resolver=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm");
    pose=await PoseLandmarker.createFromOptions(resolver,{baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",delegate:"CPU"},runningMode:"VIDEO",numPoses:2,minPoseDetectionConfidence:0.5,minPosePresenceConfidence:0.5});
    if(g!==generation.current){pose.close();return}
    model.current=pose;setPhase("ready");let last=-1,lastMs=0;
    const loop=()=>{
      if(g!==generation.current)return;
      const v=video.current,c=canvas.current,p=model.current;
      const now=performance.now();
      if(countdownEnd.current){
        const n=Math.ceil((countdownEnd.current-now)/1000);
        if(n>0)setCount(n);else{countdownEnd.current=0;recording.current=true;started.current=now;frames.current=[];setPhase("recording")}
      }
      if(recording.current&&now-started.current>=5000){setFrameCount(frames.current.length);stop();frames.current=[];setPhase("done");return}
      if(v&&c&&p&&v.readyState>=2&&v.currentTime!==last&&now-lastMs>=65){
        last=v.currentTime;lastMs=now;
        try{
          const result=p.detectForVideo(v,now);const detected=result.landmarks.length;setSeen(detected);
          c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext("2d");
          if(ctx&&detected===1){const pts=result.landmarks[0];ctx.strokeStyle="#c6f432";ctx.fillStyle="#c6f432";ctx.lineWidth=3;for(const [i,j] of edges){const a=pts[i],b=pts[j];if((a.visibility??0)<0.5||(b.visibility??0)<0.5)continue;ctx.beginPath();ctx.moveTo(a.x*c.width,a.y*c.height);ctx.lineTo(b.x*c.width,b.y*c.height);ctx.stroke()}for(const pt of pts){if((pt.visibility??0)<0.5)continue;ctx.beginPath();ctx.arc(pt.x*c.width,pt.y*c.height,3,0,Math.PI*2);ctx.fill()}}
          if(recording.current){const landmarks:PoseFrame["landmarks"]={};if(detected===1)for(const [i,name] of Object.entries(names)){const pt=result.landmarks[0][Number(i)];if(pt)landmarks[name]={x:pt.x,y:pt.y,confidence:pt.visibility??0,estimated:false}}frames.current.push({timestampMs:now-started.current,width:v.videoWidth,height:v.videoHeight,athleteCount:detected,landmarks})}
        }catch{stop();frames.current=[];setPhase("idle");setMessage("A inferência falhou. Tente novamente ou use a demo.");return}
      }
      raf.current=requestAnimationFrame(loop)
    };raf.current=requestAnimationFrame(loop)
  }catch(e){if(g===generation.current){stop();setPhase("idle");setMessage(e instanceof Error&&e.message.includes("HTTPS")?e.message:"Não foi possível iniciar câmera/modelo. Confira permissões, conexão e tente novamente.")}else{acquired?.getTracks().forEach(t=>t.stop());pose?.close()}}
 }
 return <><div className="eyebrow">Teste privado · {sport==="volleyball"?"Bloqueio":"Rebote"}</div><h1>Prepare o salto.</h1><div className="notice">Somente adultos, ambiente privado e espaço livre. Não enviamos vídeo ou landmarks. A medição real ainda aguarda a integração do protocolo da Pessoa 1.</div><label className="check"><input type="checkbox" checked={consent} onChange={e=>{setConsent(e.target.checked);if(!e.target.checked){stop();frames.current=[];setPhase("idle")}}}/>Tenho 18 anos ou mais, espaço seguro e autorizo o uso local da câmera.</label><div className="camera"><video ref={video} muted playsInline/><canvas ref={canvas} aria-hidden="true"/><div className="silhouette"/>{phase==="countdown"&&<div className="count" aria-live="polite">{count}</div>}</div><p role="status" className="subhead">{phase==="loading"?"Carregando câmera e modelo…":phase==="ready"?(seen===1?"✓ Uma pessoa detectada. Confira se os pés estão visíveis.":"⚠ Posicione apenas uma pessoa no quadro.") :phase==="recording"?"Capturando landmarks por 5 segundos…":phase==="done"?frameCount+" quadros processados localmente; sem pontuação até integrar o motor.":"Apoie o celular e deixe todo o corpo visível."}</p>{message&&<p className="notice error" role="alert">{message}</p>}<div className="stack">{(phase==="idle"||phase==="done")&&<button className="button" disabled={!consent} onClick={start}>Ativar câmera</button>}{phase==="ready"&&<button className="button" disabled={seen!==1} onClick={()=>{setCount(3);countdownEnd.current=performance.now()+3000;setPhase("countdown")}}>Começar contagem</button>}{!["idle","done"].includes(phase)&&<button className="button secondary" onClick={()=>{stop();frames.current=[];setPhase("idle")}}>Cancelar e desligar câmera</button>}<Link className="button secondary" href="/demo">Experimentar demo sintética</Link></div></>
}
