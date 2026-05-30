const { createClient } = require('@supabase/supabase-js');

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function res(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return res(200, { ok: true });
  if (event.httpMethod !== 'POST')    return res(405, { ok: false, error: 'Method not allowed' });

  try {
    // Validate session
    const token = (event.headers.authorization || event.headers.Authorization || '')
      .replace(/^Bearer\s+/i, '').trim();

    if (!token) return res(401, { ok: false, error: 'Missing token' });

    const { data: authData, error: authErr } = await db.auth.getUser(token);
    if (authErr || !authData?.user)
      return res(401, { ok: false, error: 'Session expired. Please sign in again.' });

    const user           = authData.user;
    const body           = JSON.parse(event.body || '{}');
    const name           = (body.name        || '').trim();
    const handle         = (body.handle      || '').trim().toLowerCase();
    const phone          = (body.phone       || '').trim();
    const avatarUrl      = (body.avatar_url  || '').trim();
    const updatePassword = !!body.update_password;
    const password       = (body.password    || '').trim();

    // Validate
    if (handle && !/^[a-z0-9_]{1,30}$/.test(handle))
      return res(400, { ok: false, error: 'Handle: letters, numbers, underscores only.' });

    if (updatePassword && password && password.length < 6)
      return res(400, { ok: false, error: 'Password must be at least 6 characters.' });

    // ── UPDATE PUBLIC USERS TABLE (fast — plain Postgres, no auth overhead) ──
    const { data: profile, error: profileErr } = await db
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
      if (profileErr.code === '23505')
        return res(400, { ok: false, error: 'That handle is already taken.' });
      throw profileErr;
    }

    // ── UPDATE AUTH METADATA ──
    // For avatar and non-password updates: fire and forget
    // For password updates: must wait
    const newMeta = {
      ...(user.user_metadata || {}),
      avatar_url: avatarUrl || (user.user_metadata?.avatar_url || ''),
    };

    if (updatePassword && password) {
      newMeta.account_password = password;
    }

    if (!updatePassword) {
      // Fire and forget — don't block response on this
      (async () => {
        try {
          await db.auth.admin.updateUserById(user.id, { user_metadata: newMeta });
        } catch (e) {
          console.warn('[update-profile] metadata:', e.message);
        }
      })();

      return res(200, {
        ok:      true,
        profile,
        user:    { ...user, user_metadata: newMeta },
      });
    }

    // Password change — wait for auth update
    const authPayload = {
      user_metadata: newMeta,
      password,
      email_confirm: true,
    };

    const { data: updatedAuth, error: updateErr } = await db.auth.admin
      .updateUserById(user.id, authPayload);

    if (updateErr) {
      // Profile saved, only password failed
      return res(207, {
        ok:      true,
        partial: true,
        warning: 'Profile saved. Password update failed — try again.',
        profile,
        user,
      });
    }

    return res(200, {
      ok:      true,
      profile,
      user:    updatedAuth.user,
    });

  } catch (err) {
    console.error('[update-profile]', err.message);
    return res(500, { ok: false, error: err.message });
  }
};
