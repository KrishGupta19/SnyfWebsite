import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { venue_id } = await req.json()
    if (!venue_id) {
      return new Response(JSON.stringify({ error: 'venue_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // Capture IP from Cloudflare header or client conn
    const rawIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '127.0.0.1'
    const ip = rawIp.split(',')[0].trim()

    // Cryptographic hash (SHA-256) with service role key salt for anonymization
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const encoder = new TextEncoder()
    const data = encoder.encode(ip + serviceRoleKey)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const ipHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const db = createClient(supabaseUrl, serviceRoleKey)

    // Log the visit inside DNF context
    const { error } = await db.from('visits').insert({
      venue_id,
      ip_hash: ipHash
    })

    if (error) throw error

    return new Response(JSON.stringify({ ip_hash: ipHash }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})
