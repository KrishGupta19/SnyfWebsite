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
    } else {
      // 2. Try creating user
      const { data: newUser, error: createErr } = await db.auth.admin.createUser({
        email:         emailToUse,
        email_confirm: true,
        user_metadata: { phone: normalizedPhone, source: 'waiter_placement' },
      });

      if (!createErr && newUser?.user) {
        userId = newUser.user.id;
      } else if (createErr) {
        // If auth user already exists but isn't in public users table for some reason,
        // let's try finding the auth user to get their ID
        const { data: listData } = await db.auth.admin.listUsers({ perPage: 1000 });
        const found = listData?.users?.find(
          (u) => u.email?.toLowerCase() === emailToUse.toLowerCase()
        );
        if (found) {
          userId = found.id;
        } else {
          throw new Error('Create user failed: ' + createErr.message);
        }
      }

      // Upsert to public users table
      if (userId) {
        await db.from('users').upsert({
          id:           userId,
          email:        emailToUse,
          phone:        normalizedPhone,
          trust_level:  'scout',
          report_count: 0,
          verified:     false,
        }, { onConflict: 'id', ignoreDuplicates: true });
      }
    }

    return cors(200, {
      ok: true,
      userId: userId,
    });

  } catch (err) {
    console.error('[get-or-create-user]', err.message);
    return cors(500, { ok: false, error: err.message });
  }
};
