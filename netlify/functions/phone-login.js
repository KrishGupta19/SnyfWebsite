const { createClient } = require('@supabase/supabase-js');

const db = createClient(
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
  if (event.httpMethod !== 'POST')    return cors(405, { ok: false, error: 'Method not allowed' });

  try {
    const { phone } = JSON.parse(event.body || '{}');
    if (!phone) {
      return cors(400, { ok: false, error: 'Phone number is required' });
    }

    const phoneVal = phone.trim().replace(/\D/g, '');
    if (phoneVal.length !== 10) {
      return cors(400, { ok: false, error: 'Please enter a valid 10-digit phone number' });
    }

    const normalizedPhone = `+91${phoneVal}`;
    let emailToUse = `${normalizedPhone}@snyf-phone.com`;
    let userId = null;

    // 1. Check if user already exists with this phone in public.users table
    const { data: userProfile } = await db
      .from('users')
      .select('id, email')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (userProfile) {
      userId = userProfile.id;
      emailToUse = userProfile.email || emailToUse;
    } else {
      // 2. Try creating user
      const { data: newUser, error: createErr } = await db.auth.admin.createUser({
        email:         emailToUse,
        email_confirm: true,
        user_metadata: { phone: normalizedPhone, source: 'phone_login' },
      });

      if (!createErr && newUser?.user) {
        userId = newUser.user.id;
      }
    }

    // 3. Generate magic link session using admin generateLink
    const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
      type:  'magiclink',
      email: emailToUse,
    });

    if (linkErr) throw new Error('generateLink: ' + linkErr.message);

    // If userId wasn't set because the user already existed in Auth (making createUser fail),
    // extract it directly from the generateLink user property
    if (!userId && linkData?.user) {
      userId = linkData.user.id;
    }

    if (!userId) {
      throw new Error('Failed to retrieve or create user credentials.');
    }

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

    // 4. Upsert users table asynchronously (don't block the response)
    ;(async () => {
      try {
        await db.from('users').upsert({
          id:           userId,
          email:        emailToUse,
          phone:        normalizedPhone,
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
    console.error('[phone-login]', err.message);
    return cors(500, { ok: false, error: err.message });
  }
};
