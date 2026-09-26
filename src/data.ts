import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type Student = { id:string; school_id:string; nis:string; name:string; class_name:string; gender:string; guardian_name:string; guardian_phone:string; counselor_id:string|null; status:string; created_at:string }
export type Case = { id:string; school_id:string; student_id:string; counselor_id:string; code:string; opened_on:string; domain:string; topic:string; priority:string; source:string; status:string; summary:string; next_on:string|null; created_at:string }
export type RecordItem = { id:string; school_id:string; student_id:string|null; case_id:string|null; counselor_id:string; kind:string; happened_on:string; title:string; domain:string; status:string; notes:string; confidential:boolean; details:Record<string,string>; created_at:string }
export type Membership = { school_id:string; user_id:string; role:string; display_name:string; school?:{name:string;academic_year:string}|null }
export const kinds = [
  ['need','Pemetaan kebutuhan'], ['counseling','Konseling individu'], ['group','Konseling kelompok'], ['classical','Layanan klasikal'], ['rpl','RPL layanan'], ['program','Program BK'], ['agenda','Agenda'], ['followup','Tindak lanjut'], ['visit','Kunjungan rumah'], ['referral','Rujukan'], ['career','Perencanaan karier'], ['document','Dokumen'],
] as const
export const domains=['Pribadi','Sosial','Belajar','Karier']
export const client:SupabaseClient|null = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}}):null
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
export const dateLabel=(v:string|null|undefined)=>v?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(v+'T12:00:00+07:00')):'—'
export const uid=()=>crypto.randomUUID()
export function csv(rows:Record<string,unknown>[],fields:string[]){return '\ufeff'+[fields.join(','),...rows.map(row=>fields.map(f=>'"'+String(row[f]??'').replaceAll('"','""')+'"').join(','))].join('\r\n')}
export function download(name:string,body:string){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type:'text/csv;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)}
