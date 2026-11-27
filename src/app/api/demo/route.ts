import { randomUUID } from "node:crypto";
import { evaluateFixture,validateRequest } from "@/engine/replay/synthetic.mjs";
import { mode,getSession,history,save,reset } from "@/lib/demo-store";
import type { DemoAttempt,DemoRequest,Measurement } from "@/contracts/attempt";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function json(data:unknown,status=200,cookie?:string){
  return Response.json(data,{status,headers:{"Cache-Control":"no-store",...(cookie?{"Set-Cookie":cookie}:{})}});
}
function sameOrigin(req:Request){const o=req.headers.get("origin");return o===new URL(req.url).origin;}
function fail(err:unknown){return json({error:err instanceof Error&&err.message==="IDEMPOTENCY_CONFLICT"?"IDEMPOTENCY_CONFLICT":"SERVICE_UNAVAILABLE"},err instanceof Error&&err.message==="IDEMPOTENCY_CONFLICT"?409:503)}
export async function GET(req:Request){
  try{
    if(mode()==="local")return json({persistence:"local",attempts:[]});
    const s=await getSession(req,false);
    return json({persistence:"supabase",attempts:await history(s.id)});
  }catch(err){return fail(err)}
}
export async function POST(req:Request){
  if(!sameOrigin(req))return json({error:"FORBIDDEN"},403);
  if(!req.headers.get("content-type")?.startsWith("application/json"))return json({error:"INVALID_PAYLOAD"},415);
  try{
    const reader=req.body?.getReader();
    if(!reader)return json({error:"INVALID_PAYLOAD"},400);
    const decoder=new TextDecoder();let raw="",bytes=0;
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2048){await reader.cancel();return json({error:"PAYLOAD_TOO_LARGE"},413)}raw+=decoder.decode(value,{stream:true});}
    raw+=decoder.decode();
    let body:unknown;try{body=JSON.parse(raw)}catch{return json({error:"INVALID_PAYLOAD"},400)}
    if(!validateRequest(body))return json({error:"INVALID_PAYLOAD"},400);
    const input=body as DemoRequest;
    const measurement=evaluateFixture(input.fixtureId) as Measurement;
    const attempt:DemoAttempt={id:randomUUID(),fixtureId:input.fixtureId,createdAt:new Date().toISOString(),source:"synthetic_pose_replay",measurement,rankingEligible:measurement.status==="accepted"};
    if(mode()==="local")return json({persistence:"local",attempt:{...attempt,id:input.idempotencyKey}});
    const s=await getSession(req,true);
    if(!s.id)throw new Error("SESSION_CREATE_FAILED");
    const stored=await save(s.id,input.idempotencyKey,attempt);
    return json({persistence:"supabase",attempt:stored},200,s.cookie);
  }catch(err){return fail(err)}
}
export async function DELETE(req:Request){
  if(!sameOrigin(req))return json({error:"FORBIDDEN"},403);
  try{if(mode()==="local")return json({ok:true});return json({ok:true},200,await reset(req))}catch(err){return fail(err)}
}
