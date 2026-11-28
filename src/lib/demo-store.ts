import "server-only";
import { createHash,randomBytes } from "node:crypto";
import type { DemoAttempt } from "@/contracts/attempt";
const COOKIE="mova_demo";
const TTL=60*60*24;
type SessionRow={id:string;expires_at:string};
type AttemptRow={fixture_id:string;result:DemoAttempt};
type RpcError={error:string};
const origin=process.env.SUPABASE_URL;
const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
export function mode(): "local"|"supabase" {
  if(Boolean(origin)!==Boolean(secret))throw new Error("INCOMPLETE_DATABASE_CONFIG");
  return origin&&secret?"supabase":"local";
}
async function rest<T>(path:string,init:RequestInit={}):Promise<T>{
  if(!origin||!secret)throw new Error("DATABASE_NOT_CONFIGURED");
  const base=new URL(origin);
  if(base.protocol!=="https:"&&base.hostname!=="127.0.0.1"&&base.hostname!=="localhost")throw new Error("INVALID_DATABASE_URL");
  const r=await fetch(new URL("/rest/v1/"+path,base),{...init,signal:AbortSignal.timeout(8000),cache:"no-store",headers:{"apikey":secret,"Authorization":"Bearer "+secret,"Content-Type":"application/json",...init.headers}});
  if(!r.ok)throw new Error("DATABASE_REQUEST_FAILED");
  if(r.status===204)return undefined as T;
  return await r.json() as T;
}
function token(req:Request){
  const v=req.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);
  return v&&/^[a-f0-9]{64}$/.test(v)?v:null;
}
function hash(t:string){return createHash("sha256").update(t).digest("hex")}
function cookie(req:Request,t:string,maxAge=TTL){return COOKIE+"="+t+"; Path=/; HttpOnly; SameSite=Lax; Max-Age="+maxAge+(new URL(req.url).protocol==="https:"||process.env.NODE_ENV==="production"?"; Secure":"")}
export async function getSession(req:Request,create:boolean):Promise<{id:string|null;cookie?:string}>{
  const t=token(req);
  if(t){
    const rows=await rest<SessionRow[]>("demo_sessions?select=id,expires_at&token_hash=eq."+hash(t)+"&expires_at=gt."+encodeURIComponent(new Date().toISOString())+"&limit=1");
    if(rows[0])return {id:rows[0].id};
  }
  if(!create)return {id:null};
  const fresh=randomBytes(32).toString("hex");
  const row=await rest<SessionRow|RpcError>("rpc/mova_demo_create_session",{method:"POST",body:JSON.stringify({p_token_hash:hash(fresh)})});
  if("error" in row)throw new Error(row.error);
  if(!row.id)throw new Error("SESSION_CREATE_FAILED");
  return {id:row.id,cookie:cookie(req,fresh)};
}
export async function history(id:string|null):Promise<DemoAttempt[]>{
  if(!id)return [];
  const rows=await rest<AttemptRow[]>("demo_attempts?select=result&session_id=eq."+encodeURIComponent(id)+"&order=created_at.desc&limit=100");
  return rows.map(r=>r.result);
}
export async function save(id:string,key:string,attempt:DemoAttempt):Promise<DemoAttempt>{
  const row=await rest<DemoAttempt|RpcError>("rpc/mova_demo_save",{method:"POST",body:JSON.stringify({p_session_id:id,p_idempotency_key:key,p_fixture_id:attempt.fixtureId,p_result:attempt})});
  if("error" in row)throw new Error(row.error);
  return row;
}
export async function reset(req:Request){
  const s=await getSession(req,false);
  if(s.id)await rest("demo_sessions?id=eq."+encodeURIComponent(s.id),{method:"DELETE",headers:{Prefer:"return=minimal"}});
  return cookie(req,"",0);
}
