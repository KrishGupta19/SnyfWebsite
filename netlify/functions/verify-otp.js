const { createClient } = require('@supabase/supabase-js');
const crypto           = require('crypto');

const supabaseUrl    = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey        = process.env.SUPABASE_ANON_KEY;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function hashOtp(email, otp) {
  return crypto
    .createHash('sha256')
    .update(`${email}:${otp}:${serviceRoleKey}`)
    .digest('hex');
}

function cors(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

async function handleRequest(event) {
  if (event.httpMethod === 'OPTIONS') return cors(200, { ok: true });
  if (event.httpMethod !== 'POST')    return cors(405, { ok: false, error: 'Method Not Allowed' });

  const { email, token } = JSON.parse(event.body || '{}');
  if (!email || !token)
    return cors(400, { ok: false, error: 'Email and token are required' });

  const normalizedEmail = email.trim().toLowerCase();
  const otpToken        = token.trim();

  // ── KEY FIX: Use listUsers with email filter instead of getUserByEmail
  // getUserByEmail does NOT return app_metadata in all Supabase versions
  // listUsers with filter is more reliable for reading app_metadata
  const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
    perPage: 1,
    // Note: listUsers doesn't support email filter directly
    // so we fetch by page and find manually — but limit to 1000 for speed
  });

  // Actually use the correct approach: getUserById after finding via admin API
  // The most reliable way to get app_metadata is via listUsers scan
  // For small user bases this is fine; for large bases use a separate otp table
  let authUser = null;
  if (!listErr && listData?.users) {
    authUser = listData.users.find(u => u.email?.toLowerCase() === normalizedEmail) || null;
  }

  if (!authUser) {
    return cors(400, { ok: false, error: 'Account not found. Please send OTP again.' });
  }

  const meta = authUser.app_metadata || {};

  if (!meta.snyf_otp_hash || !meta.snyf_otp_expires_at) {
    return cors(400, { ok: false, error: 'No active OTP. Please request a new code.' });
  }

  if (meta.snyf_otp_hash !== hashOtp(normalizedEmail, otpToken)) {
    return cors(400, { ok: false, error: 'Invalid code. Please try again.' });
  }

  if (Date.now() > new Date(meta.snyf_otp_expires_at).getTime()) {
    return cors(400, { ok: false, error: 'Code expired. Please request a new one.' });
  }

  // Clear OTP async — don't block response
  admin.auth.admin.updateUserById(authUser.id, {
    app_metadata: {
      ...meta,
      snyf_otp_hash:       null,
      snyf_otp_expires_at: null,
    },
  }).catch(e => console.warn('OTP clear:', e.message));

  // Generate session via magic link exchange
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type:  'magiclink',
    email: normalizedEmail,
  });
  if (linkErr) throw new Error('generateLink failed: ' + linkErr.message);

  const { data: sessionData, error: sessionErr } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type:       'magiclink',
  });
  if (sessionErr) throw new Error('verifyOtp failed: ' + sessionErr.message);

  // Upsert users table async — don't block
  admin.from('users').upsert({
    id:           authUser.id,
    email:        normalizedEmail,
    trust_level:  'scout',
    report_count: 0,
    verified:     false,
  }, { onConflict: 'id', ignoreDuplicates: true })
  .catch(e => console.warn('users upsert:', e.message));

  return cors(200, {
    ok:            true,
    access_token:  sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    user:          sessionData.session.user,
  });
}

exports.handler = (event) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout — please try again')), 9000)
  );
  return Promise.race([handleRequest(event), timeout]).catch(err =>
    cors(500, { ok: false, error: err.message })
  );
};
