import type {PoseFrame} from "@/contracts/attempt";
export const NAMES:Record<number,string>={0:"nose",11:"left_shoulder",12:"right_shoulder",13:"left_elbow",14:"right_elbow",15:"left_wrist",16:"right_wrist",23:"left_hip",24:"right_hip",25:"left_knee",26:"right_knee",27:"left_ankle",28:"right_ankle",29:"left_heel",30:"right_heel",31:"left_foot_index",32:"right_foot_index"};
export type ModelPoint={x:number;y:number;visibility?:number};
export function adaptPose(poses:ModelPoint[][],timestampMs:number,width:number,height:number):PoseFrame{
 const landmarks:PoseFrame["landmarks"]={};
 if(poses.length===1)for(const [i,name] of Object.entries(NAMES)){const p=poses[0][Number(i)];if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))landmarks[name]={x:p.x,y:p.y,confidence:Math.max(0,Math.min(1,p.visibility??0)),estimated:false};}
 return {timestampMs,width,height,athleteCount:poses.length,landmarks};
}
export async function createPoseModel(){
 const {FilesetResolver,PoseLandmarker}=await import("@mediapipe/tasks-vision");
 const resolver=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm");
 return PoseLandmarker.createFromOptions(resolver,{baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",delegate:"CPU"},runningMode:"VIDEO",numPoses:2,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5});
}
