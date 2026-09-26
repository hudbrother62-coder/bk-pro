import { createClient } from 'npm:@supabase/supabase-js@2.57.0'

const origins = new Set([
  'https://bk-pro.vercel.app',
  'https://bk-pro-hudbrother62-2859.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
])

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || ''
  if (!origins.has(origin)) return new Response('Forbidden', { status: 403 })
  const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !secret) throw new Error('Server configuration unavailable')
    const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
    const ipKey = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
    const [limited, global] = await Promise.all([
      admin.rpc('allow_bk_signup', { p_key: `ip:${ipKey}`, p_limit: 8 }),
      admin.rpc('allow_bk_signup', { p_key: 'global', p_limit: 100 }),
    ])
    if (limited.error || global.error) throw new Error('Rate limit unavailable')
    if (!limited.data || !global.data) return new Response(JSON.stringify({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }), { status: 429, headers })
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) {
      return new Response(JSON.stringify({ error: 'Gunakan email valid dan kata sandi 8–128 karakter.' }), { status: 400, headers })
    }
    const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) return new Response(JSON.stringify({ error: 'Akun tidak dapat dibuat. Jika sudah terdaftar, silakan masuk.' }), { status: 400, headers })
    return new Response(JSON.stringify({ ok: true }), { status: 201, headers })
  } catch {
    return new Response(JSON.stringify({ error: 'Pendaftaran belum tersedia. Coba lagi.' }), { status: 503, headers })
  }
})
