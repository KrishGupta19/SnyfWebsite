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
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Edge function not configured correctly.');
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Validate session ──────────────────────────────────────
    const token = req.headers.get('Authorization')
      ?.replace(/^Bearer\s+/i, '').trim();

    if (!token) return res(401, { ok: false, error: 'Missing token.' });

    const { data: authData, error: authErr } = await db.auth.getUser(token);
    if (authErr || !authData?.user)
      return res(401, { ok: false, error: 'Session expired. Please sign in again.' });

    const user           = authData.user;
    const body           = await req.json();
    const name           = (body.name       || '').trim();
    const handle         = (body.handle     || '').trim().toLowerCase();
    const phone          = (body.phone      || '').trim();
    const email          = (body.email      || '').trim().toLowerCase();
    const avatarUrl      = (body.avatar_url || '').trim();
    const updatePassword = !!body.update_password;
    const password       = (body.password   || '').trim();

    // ── Validate inputs ───────────────────────────────────────
    if (handle && !/^[a-z0-9_]{1,30}$/.test(handle))
      return res(400, { ok: false, error: 'Handle: letters, numbers, underscores only (max 30).' });

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
      avatar_url: avatarUrl || ((user.user_metadata as any)?.avatar_url || ''),
    };
    if (updatePassword && password) newMeta.account_password = password;

    // ── Update Auth ───────────────────────────────────────────
    const updateFields: any = { user_metadata: newMeta };
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

    // ── Update public users table (fast Postgres) ─────────────
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

  } catch (err: any) {
    console.error('[update-profile]', err.message);
    return res(500, { ok: false, error: err.message });
  }
});
