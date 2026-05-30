const { createClient } = require('@supabase/supabase-js');

const supabaseUrl    = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

async function handleUpdate(event) {
  if (event.httpMethod === 'OPTIONS') return response(200, { ok: true });
  if (event.httpMethod !== 'POST')    return response(405, { ok: false, error: 'Method Not Allowed' });

  if (!supabaseUrl || !serviceRoleKey) {
    return response(500, { ok: false, error: 'Service not configured.' });
  }

  // Validate session token
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token      = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) return response(401, { ok: false, error: 'Missing session token.' });

  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData?.user) {
    return response(401, { ok: false, error: 'Invalid or expired session. Please sign in again.' });
  }

  const user = authData.user;
  const body = JSON.parse(event.body || '{}');

  const name     = (body.name     || '').trim();
  const handle   = (body.handle   || '').trim().toLowerCase();
  const phone    = (body.phone    || '').trim();
  const avatarUrl = body.avatar_url || '';
  const updatePassword = !!body.update_password;
  const password = (body.password || '').trim();

  // Validate handle format
  if (handle && !/^[a-z0-9_]{1,30}$/.test(handle)) {
    return response(400, { ok: false, error: 'Handle can only contain letters, numbers, and underscores.' });
  }

  // Validate password length
  if (updatePassword && password && password.length < 6) {
    return response(400, { ok: false, error: 'Password must be at least 6 characters.' });
  }

  // 1. Update public users table
  const profilePayload = {
    id:     user.id,
    email:  user.email,
    name:   name   || null,
    handle: handle || null,
    phone:  phone  || null,
  };

  const { data: profile, error: profileErr } = await admin
    .from('users')
    .upsert(profilePayload, { onConflict: 'id' })
    .select('*')
    .single();

  if (profileErr) {
    console.error('users upsert error:', profileErr);
    return response(500, { ok: false, error: profileErr.message });
  }

  // 2. Update Supabase Auth (metadata + optional password)
  // Build auth payload
  const newMetadata = {
    ...(user.user_metadata || {}),
    avatar_url: avatarUrl || (user.user_metadata?.avatar_url || ''),
  };

  if (updatePassword) {
    // Store plaintext in metadata for password sign-in
    newMetadata.account_password = password || null;
  }

  const authPayload = { user_metadata: newMetadata };

  if (updatePassword && password) {
    authPayload.password       = password;
    authPayload.email_confirm  = true;
  }

  const { data: updatedAuth, error: updateErr } = await admin.auth.admin.updateUserById(
    user.id,
    authPayload
  );

  if (updateErr) {
    console.error('updateUserById error:', updateErr);
    // Don't fail the whole request — profile was saved, auth update failed
    // Return partial success so user knows profile saved but password may not have
    return response(207, {
      ok:      true,
      partial: true,
      warning: 'Profile saved but password update failed. Try again.',
      profile,
      user:    user,
    });
  }

  return response(200, {
    ok:      true,
    profile,
    user:    updatedAuth.user,
  });
}

// Wrap with 9-second timeout
exports.handler = (event) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error('Request timed out. Please try again.')),
      9000
    )
  );
  return Promise.race([handleUpdate(event), timeout]).catch(err => ({
    statusCode: 500,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ ok: false, error: err.message }),
  }));
};
