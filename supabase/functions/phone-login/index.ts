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
    const { phone } = await req.json();
    if (!phone) {
      return res(400, { ok: false, error: 'Phone number is required' });
    }

    const phoneVal = phone.trim().replace(/\D/g, '');
    if (phoneVal.length !== 10) {
      return res(400, { ok: false, error: 'Please enter a valid 10-digit phone number' });
    }

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Edge function not configured correctly.');
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const normalizedPhone = `+91${phoneVal}`;
    let emailToUse = `${normalizedPhone}@snyf-phone.com`;
    let userId: string;

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
      } else {
        // User might exist in auth but not in users table yet
        const { data: listData, error: listErr } = await db.auth.admin.listUsers({
          perPage: 1000,
        });
        if (listErr) throw new Error('listUsers failed: ' + listErr.message);
        const found = listData?.users?.find(
          (u: any) => u.email?.toLowerCase() === emailToUse
        );
        if (!found) {
          return res(400, { ok: false, error: createErr?.message || 'Failed to authenticate user.' });
        }
        userId = found.id;
      }
    }

    // 3. Generate magic link session using admin generateLink
    const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
      type:  'magiclink',
      email: emailToUse,
    });

    if (linkErr) throw new Error('generateLink failed: ' + linkErr.message);

    const { data: sessionData, error: sessionErr } = await anon.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type:       'magiclink',
    });

    if (sessionErr) throw new Error('verifyOtp failed: ' + sessionErr.message);

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
      } catch (e: any) {
        console.warn('users upsert:', e.message);
      }
    })();

    return res(200, {
      ok:            true,
      access_token:  sessionData.session!.access_token,
      refresh_token: sessionData.session!.refresh_token,
      user:          sessionData.session!.user,
    });

  } catch (err: any) {
    console.error('[phone-login]', err.message);
    return res(500, { ok: false, error: err.message });
  }
});
