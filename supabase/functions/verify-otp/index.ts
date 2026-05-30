import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function res(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')   return res(405, { ok: false, error: 'Method not allowed' });

  try {
    const { email, token } = await req.json();
    if (!email || !token)
      return res(400, { ok: false, error: 'Email and code required' });

    const normalizedEmail = email.trim().toLowerCase();
    const code            = token.trim();

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Edge function not configured correctly.');
    }

    const db   = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Hash submitted code ───────────────────────────────────
    const encoder       = new TextEncoder();
    const hashBuf       = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(`${normalizedEmail}:${code}:${serviceRoleKey}`)
    );
    const submittedHash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // ── Verify OTP from table (fast Postgres lookup) ──────────
    const { data: otpRow, error: otpErr } = await db
      .from('otp_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpErr || !otpRow)
      return res(400, { ok: false, error: 'No active OTP. Please request a new code.' });

    if (otpRow.code_hash !== submittedHash)
      return res(400, { ok: false, error: 'Invalid code. Please try again.' });

    // ── Mark OTP used ─────────────────────────────────────────
    await db.from('otp_codes').update({ used: true }).eq('id', otpRow.id);

    // ── Get or create auth user ───────────────────────────────
    let userId: string;

    const { data: newUser, error: createErr } = await db.auth.admin.createUser({
      email:         normalizedEmail,
      email_confirm: true,
      user_metadata: { source: 'otp_login' },
    });

    if (!createErr && newUser?.user) {
      // New user created
      userId = newUser.user.id;
    } else {
      // User exists — find via listUsers (small user base, fast enough)
      const { data: listData, error: listErr } = await db.auth.admin.listUsers({
        perPage: 1000,
      });
      if (listErr) throw new Error('listUsers failed: ' + listErr.message);
      const found = listData?.users?.find(
        (u: any) => u.email?.toLowerCase() === normalizedEmail
      );
      if (!found) return res(400, { ok: false, error: 'Account not found. Please send OTP again.' });
      userId = found.id;
    }

    // ── Generate session ──────────────────────────────────────
    const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
      type:  'magiclink',
      email: normalizedEmail,
    });
    if (linkErr) throw new Error('generateLink failed: ' + linkErr.message);

    const { data: sessionData, error: sessionErr } = await anon.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type:       'magiclink',
    });
    if (sessionErr) throw new Error('Session creation failed: ' + sessionErr.message);

    // ── Upsert users table (non-blocking) ─────────────────────
    (async () => {
      try {
        await db.from('users').upsert({
          id:           userId,
          email:        normalizedEmail,
          trust_level:  'scout',
          report_count: 0,
          verified:     false,
        }, { onConflict: 'id', ignoreDuplicates: true });
      } catch (e: any) {
        console.warn('[verify-otp] users upsert:', e.message);
      }
    })();

    return res(200, {
      ok:            true,
      access_token:  sessionData.session!.access_token,
      refresh_token: sessionData.session!.refresh_token,
      user:          sessionData.session!.user,
    });

  } catch (err: any) {
    console.error('[verify-otp]', err.message);
    return res(500, { ok: false, error: err.message });
  }
});
