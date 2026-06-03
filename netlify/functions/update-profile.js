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
    const email          = (body.email       || '').trim().toLowerCase();
    const avatarUrl      = (body.avatar_url  || '').trim();
    const updatePassword = !!body.update_password;
    const password       = (body.password    || '').trim();

    // Validate
    if (handle && !/^[a-z0-9_]{1,30}$/.test(handle))
      return res(400, { ok: false, error: 'Handle: letters, numbers, underscores only.' });

    if (updatePassword && password && password.length < 6)
      return res(400, { ok: false, error: 'Password must be at least 6 characters.' });

    if (email && email !== user.email) {
      if (!email.includes('@') || !email.includes('.')) {
        return res(400, { ok: false, error: 'Invalid email address.' });
      }

      // Check if email is already taken by another user in public.users
      const { data: existingUser } = await db
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingUser && existingUser.id !== user.id) {
        return res(400, { ok: false, error: 'This email address is already linked to another account.' });
      }
    }

    const newMeta = {
      ...(user.user_metadata || {}),
      avatar_url: avatarUrl || (user.user_metadata?.avatar_url || ''),
    };

    if (updatePassword && password) {
      newMeta.account_password = password;
    }

    // ── Update Auth ───────────────────────────────────────────
    const updateFields = { user_metadata: newMeta };
    if (updatePassword && password) {
      updateFields.password = password;
      updateFields.email_confirm = true;
    }
    if (email && email !== user.email) {
      updateFields.email = email;
      updateFields.email_confirm = true;
    }

    const { data: updatedAuth, error: updateErr } = await db.auth.admin.updateUserById(
      user.id,
      updateFields
    );

    if (updateErr) {
      if (updateErr.message?.toLowerCase().includes('email_exists') || updateErr.message?.toLowerCase().includes('already registered')) {
        return res(400, { ok: false, error: 'This email address is already linked to another account.' });
      }
      return res(400, { ok: false, error: updateErr.message });
    }

    const finalEmail = updatedAuth?.user?.email || email || user.email;

    // ── UPDATE PUBLIC USERS TABLE (fast — plain Postgres, no auth overhead) ──
    const { data: profile, error: profileErr } = await db
      .from('users')
      .upsert({
        id:     user.id,
        email:  finalEmail,
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
