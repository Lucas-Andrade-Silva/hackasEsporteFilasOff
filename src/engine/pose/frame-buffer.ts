import type {PoseFrame} from "@/contracts/attempt";
import {adaptPose,createPoseModel} from "./mediapipe-adapter";
export type PixelFrame={timestampMs:number;pixels:ImageData};
export const MAX_BYTES=64*1024*1024;
export function snapshot(video:HTMLVideoElement,canvas:HTMLCanvasElement,timestampMs:number,frames:PixelFrame[],maxSide=480){
 const scale=Math.min(1,maxSide/Math.max(video.videoWidth,video.videoHeight));
 const w=Math.max(1,Math.round(video.videoWidth*scale)),h=Math.max(1,Math.round(video.videoHeight*scale));
 if(!video.videoWidth||!video.videoHeight||!Number.isFinite(timestampMs))return;
 if(frames.length&&timestampMs<=frames[frames.length-1].timestampMs)return;
 if((frames.length+1)*w*h*4>MAX_BYTES||frames.length>=240)throw Error("FRAME_BUFFER_LIMIT");
 if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
 const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)throw Error("CANVAS_UNAVAILABLE");
 ctx.drawImage(video,0,0,w,h);frames.push({timestampMs,pixels:ctx.getImageData(0,0,w,h)});
}
export async function decodeClip(video:HTMLVideoElement,signal:AbortSignal):Promise<PixelFrame[]>{
 const frames:PixelFrame[]=[],canvas=document.createElement("canvas");
 if(!video.requestVideoFrameCallback||!video.cancelVideoFrameCallback)throw Error("VIDEO_CALLBACK_UNAVAILABLE");
 if(signal.aborted)throw Error("CANCELLED");
 video.playbackRate=.5;
 return new Promise((resolve,reject)=>{
 let done=false,handle=0;const timer=setTimeout(()=>finish(Error("VIDEO_TIMEOUT")),25000);
 const finish=(e?:Error)=>{if(done)return;done=true;clearTimeout(timer);video.cancelVideoFrameCallback(handle);video.removeEventListener("ended",ended);video.removeEventListener("error",failed);signal.removeEventListener("abort",abort);video.pause();if(e){frames.length=0;reject(e)}else resolve(frames)};
 const ended=()=>finish(),failed=()=>finish(Error("VIDEO_DECODE_FAILED")),abort=()=>finish(Error("CANCELLED"));
 const next:VideoFrameRequestCallback=(_now,meta)=>{if(done)return;try{snapshot(video,canvas,meta.mediaTime*1000,frames);handle=video.requestVideoFrameCallback(next)}catch(e){finish(e instanceof Error?e:Error("FRAME_FAILED"))}};
 video.addEventListener("ended",ended);video.addEventListener("error",failed);signal.addEventListener("abort",abort,{once:true});handle=video.requestVideoFrameCallback(next);video.play().catch(()=>finish(Error("PLAYBACK_FAILED")));
 });
}
export async function inferBuffered(frames:PixelFrame[],signal:AbortSignal,onFrame?:(frame:PoseFrame,index:number,total:number,canvas:HTMLCanvasElement)=>void){
 if(!frames.length)throw Error("NO_DECODED_FRAMES");
 if(signal.aborted)throw Error("CANCELLED");
 let expired=false;let timer:ReturnType<typeof setTimeout>|undefined;
 const modelPromise=createPoseModel().then(model=>{if(expired||signal.aborted){model.close();throw Error("MODEL_CANCELLED")}return model});
 const model=await Promise.race([modelPromise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error("MODEL_TIMEOUT"))},30000)})]).finally(()=>clearTimeout(timer));
 const output:PoseFrame[]=[],canvas=document.createElement("canvas");let inferenceMs=0;
 try{for(let i=0;i<frames.length;i++){
 if(signal.aborted)throw Error("CANCELLED");
 const {timestampMs,pixels}=frames[i];canvas.width=pixels.width;canvas.height=pixels.height;
 const ctx=canvas.getContext("2d");if(!ctx)throw Error("CANVAS_UNAVAILABLE");ctx.putImageData(pixels,0,0);
 const start=performance.now(),raw=model.detectForVideo(canvas,timestampMs);inferenceMs+=performance.now()-start;
 const frame=adaptPose(raw.landmarks,timestampMs,canvas.width,canvas.height);output.push(frame);onFrame?.(frame,i+1,frames.length,canvas);
 await new Promise<void>(r=>setTimeout(r,0));
 }return {frames:output,inferenceMs};
 }finally{model.close();frames.length=0;canvas.width=1;canvas.height=1}
}

export async function captureBuffered(video:HTMLVideoElement,signal:AbortSignal,durationMs=5000):Promise<PixelFrame[]>{
 if(!video.requestVideoFrameCallback||!video.cancelVideoFrameCallback)throw Error("VIDEO_CALLBACK_UNAVAILABLE");
 if(signal.aborted)throw Error("CANCELLED");
 const frames:PixelFrame[]=[],canvas=document.createElement("canvas");
 return new Promise((resolve,reject)=>{
 let done=false,handle=0;const timer=setTimeout(()=>finish(),durationMs);
 const finish=(e?:Error)=>{if(done)return;done=true;clearTimeout(timer);video.cancelVideoFrameCallback(handle);signal.removeEventListener("abort",abort);if(e){frames.length=0;reject(e)}else resolve(frames)};
 const abort=()=>finish(Error("CANCELLED"));
 const next:VideoFrameRequestCallback=(_now,meta)=>{if(done)return;try{snapshot(video,canvas,meta.mediaTime*1000,frames,320);handle=video.requestVideoFrameCallback(next)}catch(e){finish(e instanceof Error?e:Error("FRAME_FAILED"))}};
 signal.addEventListener("abort",abort,{once:true});handle=video.requestVideoFrameCallback(next);
 });
}
