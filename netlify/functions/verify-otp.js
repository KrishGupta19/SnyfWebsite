const { createClient } = require('@supabase/supabase-js');
const crypto           = require('crypto');

const db   = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function cors(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors(200, { ok: true });
  if (event.httpMethod !== 'POST')    return cors(405, { ok: false });

  try {
    const { email, token } = JSON.parse(event.body || '{}');
    if (!email || !token)
      return cors(400, { ok: false, error: 'Email and code required' });

    const normalizedEmail = email.trim().toLowerCase();
    const code            = token.trim();

    // Hash submitted code
    const submittedHash = crypto
      .createHash('sha256')
      .update(`${normalizedEmail}:${code}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`)
      .digest('hex');

    // ── STEP 1: Verify OTP from table (fast Postgres lookup) ──
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
      return cors(400, { ok: false, error: 'No active OTP. Please request a new code.' });

    if (otpRow.code_hash !== submittedHash)
      return cors(400, { ok: false, error: 'Invalid code. Please try again.' });

    // ── STEP 2: Mark OTP used (fast) ──
    await db.from('otp_codes')
      .update({ used: true })
      .eq('id', otpRow.id);

    // ── STEP 3: Get or create user, then generate session ──
    // Try creating user first
    let userId = null;
    const { data: newUser, error: createErr } = await db.auth.admin.createUser({
      email:         normalizedEmail,
      email_confirm: true,
      user_metadata: { source: 'otp_login' },
    });

    if (!createErr && newUser?.user) {
      userId = newUser.user.id;
    } else {
      // User exists — find via listUsers
      const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
      const found = list?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
      if (!found) return cors(400, { ok: false, error: 'Account not found.' });
      userId = found.id;
    }

    // ── STEP 4: Generate session using admin generateLink ──
    const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
      type:  'magiclink',
      email: normalizedEmail,
    });

    if (linkErr) throw new Error('generateLink: ' + linkErr.message);

    // Exchange hashed token for session using anon client
    const anon = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: sessionData, error: sessionErr } = await anon.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type:       'magiclink',
    });

    if (sessionErr) throw new Error('verifyOtp: ' + sessionErr.message);

    // ── STEP 5: Upsert users table (async, don't block) ──
    ;(async () => {
      try {
        await db.from('users').upsert({
          id:           userId,
          email:        normalizedEmail,
          trust_level:  'scout',
          report_count: 0,
          verified:     false,
        }, { onConflict: 'id', ignoreDuplicates: true });
      } catch (e) {
        console.warn('users upsert:', e.message);
      }
    })();

    return cors(200, {
      ok:            true,
      access_token:  sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      user:          sessionData.session.user,
    });

  } catch (err) {
    console.error('[verify-otp]', err.message);
    return cors(500, { ok: false, error: err.message });
  }
};
