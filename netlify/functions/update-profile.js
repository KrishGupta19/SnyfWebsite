const { createClient } = require('@supabase/supabase-js');

const supabaseUrl    = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function res(statusCode, body) {
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
  if (event.httpMethod === 'OPTIONS') return res(200, { ok: true });
  if (event.httpMethod !== 'POST')    return res(405, { ok: false, error: 'Method Not Allowed' });

  if (!supabaseUrl || !serviceRoleKey)
    return res(500, { ok: false, error: 'Service not configured.' });

  // Validate token
  const token = (event.headers.authorization || event.headers.Authorization || '')
    .replace(/^Bearer\s+/i, '').trim();

  if (!token) return res(401, { ok: false, error: 'Missing session token.' });

  // Use getUser — faster than getUserByEmail for token validation
  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData?.user)
    return res(401, { ok: false, error: 'Session expired. Please sign in again.' });

  const user   = authData.user;
  const body   = JSON.parse(event.body || '{}');

  const name           = (body.name     || '').trim();
  const handle         = (body.handle   || '').trim().toLowerCase();
  const phone          = (body.phone    || '').trim();
  const avatarUrl      = (body.avatar_url || '').trim();
  const updatePassword = !!body.update_password;
  const password       = (body.password || '').trim();

  // Validate
  if (handle && !/^[a-z0-9_]{1,30}$/.test(handle))
    return res(400, { ok: false, error: 'Handle: letters, numbers, underscores only.' });

  if (updatePassword && password && password.length < 6)
    return res(400, { ok: false, error: 'Password must be at least 6 characters.' });

  // ── STEP 1: Update public users table (fast — plain Postgres) ──
  const { data: profile, error: profileErr } = await admin
    .from('users')
    .upsert({
      id:     user.id,
      email:  user.email,
      name:   name   || null,
      handle: handle || null,
      phone:  phone  || null,
    }, { onConflict: 'id' })
    .select('*')
    .single();

  if (profileErr) {
    // Handle duplicate handle
    if (profileErr.code === '23505')
      return res(400, { ok: false, error: 'That handle is already taken.' });
    return res(500, { ok: false, error: profileErr.message });
  }

  // ── STEP 2: Update Supabase Auth metadata (slow — do async if no password change) ──
  const newMeta = {
    ...(user.user_metadata || {}),
    avatar_url: avatarUrl || (user.user_metadata?.avatar_url || ''),
  };

  if (updatePassword && password) {
    newMeta.account_password = password;
  }

  const authPayload = { user_metadata: newMeta };
  if (updatePassword && password) {
    authPayload.password      = password;
    authPayload.email_confirm = true;
  }

  if (!updatePassword) {
    // No password change — update auth metadata in background, return immediately
    admin.auth.admin.updateUserById(user.id, authPayload)
      .catch(e => console.warn('auth metadata update:', e.message));

    // Return immediately with profile — don't wait for auth update
    return res(200, {
      ok:      true,
      profile,
      user:    { ...user, user_metadata: newMeta },
    });
  }

  // Password change — must wait for auth update to confirm
  const { data: updatedAuth, error: updateErr } = await admin.auth.admin.updateUserById(
    user.id,
    authPayload
  );

  if (updateErr) {
    // Profile saved, password failed — partial success
    return res(207, {
      ok:      true,
      partial: true,
      warning: 'Profile saved. Password update failed — please try again.',
      profile,
      user,
    });
  }

  return res(200, {
    ok:      true,
    profile,
    user:    updatedAuth.user,
  });
}

exports.handler = (event) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout. Please try again.')), 9000)
  );
  return Promise.race([handleUpdate(event), timeout]).catch(err =>
    res(500, { ok: false, error: err.message })
  );
};
