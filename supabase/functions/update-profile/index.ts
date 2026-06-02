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
    const avatarUrl      = (body.avatar_url || '').trim();
    const updatePassword = !!body.update_password;
    const password       = (body.password   || '').trim();

    // ── Validate inputs ───────────────────────────────────────
    if (handle && !/^[a-z0-9_]{1,30}$/.test(handle))
      return res(400, { ok: false, error: 'Handle: letters, numbers, underscores only (max 30).' });

    if (updatePassword && password && password.length < 6)
      return res(400, { ok: false, error: 'Password must be at least 6 characters.' });

    // ── Update public users table (fast Postgres) ─────────────
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

    const newMeta = {
      ...(user.user_metadata || {}),
      avatar_url: avatarUrl || ((user.user_metadata as any)?.avatar_url || ''),
    };
    if (updatePassword && password) newMeta.account_password = password;

    const shouldUpdatePhone = phone && phone !== (user.phone || '');
    const updateParams: any = { user_metadata: newMeta };
    
    if (updatePassword && password) {
      updateParams.password = password;
      updateParams.email_confirm = true;
    }
    if (shouldUpdatePhone) {
      updateParams.phone = phone;
      updateParams.phone_confirm = true;
    }

    const hasAuthUpdates = (updatePassword && password) || shouldUpdatePhone;

    if (!hasAuthUpdates) {
      // ── No auth change: fire and forget auth metadata ───
      (async () => {
        try {
          await db.auth.admin.updateUserById(user.id, { user_metadata: newMeta });
        } catch (e: any) {
          console.warn('[update-profile] metadata update:', e.message);
        }
      })();

      return res(200, {
        ok:      true,
        profile,
        user:    { ...user, user_metadata: newMeta },
      });
    }

    // ── Auth change: must await ───────────────────────────
    const { data: updatedAuth, error: updateErr } = await db.auth.admin.updateUserById(
      user.id,
      updateParams
    );

    if (updateErr) {
      // Profile saved, only auth update failed
      return res(207, {
        ok:      true,
        partial: true,
        warning: 'Profile saved. Authentication credentials update failed — please try again.',
        profile,
        user,
      });
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
