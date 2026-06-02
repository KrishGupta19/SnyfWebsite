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
    const { email, phone, token } = await req.json();
    const input = (email || phone || '').trim();
    if (!input || !token)
      return res(400, { ok: false, error: 'Email/Phone and code required' });

    const isPhone = !input.includes('@');
    const normalizedIdentifier = isPhone ? input : input.toLowerCase();
    const code            = token.trim();

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Edge function not configured correctly.');
    }

    const db   = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Hash submitted code ───────────────────────────────────
    const encoder       = new TextEncoder();
    const hashBuf       = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(`${normalizedIdentifier}:${code}:${serviceRoleKey}`)
    );
    const submittedHash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // ── Verify OTP from table (fast Postgres lookup) ──────────
    const { data: otpRow, error: otpErr } = await db
      .from('otp_codes')
      .select('*')
      .eq('email', normalizedIdentifier)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpErr || !otpRow)
      return res(400, { ok: false, error: 'No active OTP. Please request a new code.' });

    if (otpRow.code_hash !== submittedHash)
      return res(400, { ok: false, error: 'Invalid code. Please try again.' });

    // ── Mark OTP used ─────────────────────────────────────────
    await db.from('otp_codes').update({ used: true }).eq('id', otpRow.id);

    // ── Get or create auth user ───────────────────────────────
    let userId: string;
    let authUser: any = null;

    const { data: listData, error: listErr } = await db.auth.admin.listUsers({
      perPage: 1000,
    });
    if (listErr) throw new Error('listUsers failed: ' + listErr.message);

    const cleanInputPhone = isPhone ? normalizedIdentifier.replace(/[^0-9+]/g, '') : '';
    const dummyEmail = isPhone ? `phone-${cleanInputPhone}@snyf.co.in`.toLowerCase() : '';

    const found = listData?.users?.find((u: any) => {
      if (isPhone) {
        const cleanUPhone = u.phone?.replace(/[^0-9+]/g, '');
        return cleanUPhone === cleanInputPhone || u.phone === normalizedIdentifier || u.email?.toLowerCase() === dummyEmail;
      } else {
        return u.email?.toLowerCase() === normalizedIdentifier;
      }
    });

    if (found) {
      userId = found.id;
      authUser = found;
    } else {
      const createParams: any = {
        user_metadata: { source: 'otp_login' }
      };

      if (isPhone) {
        createParams.email = dummyEmail;
        createParams.email_confirm = true;
        createParams.phone = normalizedIdentifier;
        createParams.phone_confirm = true;
      } else {
        createParams.email = normalizedIdentifier;
        createParams.email_confirm = true;
      }

      const { data: newUser, error: createErr } = await db.auth.admin.createUser(createParams);
      if (createErr || !newUser?.user) {
        throw new Error('Failed to create user: ' + (createErr?.message || 'unknown error'));
      }
      userId = newUser.user.id;
      authUser = newUser.user;
    }

    const userEmail = authUser.email;
    if (!userEmail) {
      throw new Error('Failed to identify email address for auth user.');
    }

    // ── Generate session ──────────────────────────────────────
    const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
      type:  'magiclink',
      email: userEmail,
    });
    if (linkErr) throw new Error('generateLink failed: ' + linkErr.message);

    const { data: sessionData, error: sessionErr } = await anon.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type:       'magiclink',
    });
    if (sessionErr) throw new Error('Session creation failed: ' + sessionErr.message);

    // ── Perform User ID Migration if old mock data exists ─────
    try {
      // Find if there is an existing public user with the same identifier but different ID
      let existingUser = null;
      let findErr = null;

      if (isPhone) {
        const { data, error } = await db
          .from('users')
          .select('id')
          .eq('phone', normalizedIdentifier)
          .neq('id', userId)
          .maybeSingle();
        existingUser = data;
        findErr = error;
      } else {
        const { data, error } = await db
          .from('users')
          .select('id')
          .eq('email', normalizedIdentifier)
          .neq('id', userId)
          .maybeSingle();
        existingUser = data;
        findErr = error;
      }

      if (!findErr && existingUser) {
        const oldUserId = existingUser.id;
        console.log(`[verify-otp] Migrating old user ${oldUserId} to new authenticated user ${userId}`);

        // Update orders to new user ID
        await db.from('orders')
          .update({ user_id: userId })
          .eq('user_id', oldUserId);

        // Update field_reports to new user ID
        await db.from('field_reports')
          .update({ user_id: userId })
          .eq('user_id', oldUserId);

        // Delete blank user profile for new ID if it was already created
        await db.from('users')
          .delete()
          .eq('id', userId);

        // Change ID of old user to the new authenticated user ID
        const { error: updateProfileErr } = await db.from('users')
          .update({ id: userId })
          .eq('id', oldUserId);

        if (updateProfileErr) {
          throw new Error('Failed to update public user ID: ' + updateProfileErr.message);
        }
      } else {
        // Normal upsert if no old record or already migrated
        const upsertPayload: any = {
          id:           userId,
          trust_level:  'scout',
          report_count: 0,
          verified:     false,
        };
        if (isPhone) {
          upsertPayload.phone = normalizedIdentifier;
          upsertPayload.email = userEmail;
        } else {
          upsertPayload.email = normalizedIdentifier;
        }

        await db.from('users').upsert(upsertPayload, { onConflict: 'id', ignoreDuplicates: true });
      }
    } catch (e: any) {
      console.error('[verify-otp] Migration error:', e.message);
      // Fallback: try standard upsert so login doesn't fail entirely
      try {
        const upsertPayload: any = {
          id:           userId,
          trust_level:  'scout',
          report_count: 0,
          verified:     false,
        };
        if (isPhone) {
          upsertPayload.phone = normalizedIdentifier;
          upsertPayload.email = userEmail;
        } else {
          upsertPayload.email = normalizedIdentifier;
        }
        await db.from('users').upsert(upsertPayload, { onConflict: 'id', ignoreDuplicates: true });
      } catch (upsertErr: any) {
        console.error('[verify-otp] Fallback upsert failed:', upsertErr.message);
      }
    }

    return res(200, {
      ok:            true,
      access_token:  sessionData.session!.access_token,
      refresh_token: sessionData.session!.refresh_token,
      user:          sessionData.session!.user,
    });

  } catch (err: any) {
    console.error('[verify-otp]', err.message);
    return res(500, { ok: false, error: err.message });
  }
});
