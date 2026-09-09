import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
export function taskUser(request: Request) { const key=request.headers.get("x-poko-key")?.trim()??""; return key.length>=6&&key.length<=100?createHash("sha256").update(key).digest("hex"):null; }
export function taskDb(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!secret)throw new Error("Supabase environment variables are missing");return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})}
export function reply(body:unknown,status=200){return Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}})}
export function validOrigin(request:Request){const origin=request.headers.get("origin");return !origin||origin===new URL(request.url).origin}
export function taskFailure(error:unknown){console.error("Poko task request failed",error instanceof Error?error.message:"unknown error");return reply({error:"Your tasks could not be saved or loaded. Check Supabase setup and try again."},503)}
