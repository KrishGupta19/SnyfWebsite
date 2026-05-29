const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

// Admin client for privileged operations
const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Anon client — used to exchange the magic link token for a real session
const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
            },
            body: '',
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { email, token } = JSON.parse(event.body);
        if (!email || !token) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ ok: false, error: 'Email and token are required' }),
            };
        }

        const normalizedEmail = email.trim().toLowerCase();
        const otpToken = token.trim();

        // 1. Fetch waitlist record + stored OTP
        const { data: wlUser } = await admin
            .from('waitlist')
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (!wlUser || !wlUser.notes || !wlUser.notes.startsWith('otp:')) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ ok: false, error: 'No active OTP request found for this email.' }),
            };
        }

        // Parse "otp:CODE:EXPIRY"
        const parts = wlUser.notes.split(':');
        const storedCode = parts[1];
        const expiry = parseInt(parts[2], 10);

        // 2. Validate OTP
        if (storedCode !== otpToken) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ ok: false, error: 'Invalid verification code. Please try again.' }),
            };
        }
        if (Date.now() > expiry) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ ok: false, error: 'Verification code has expired. Please request a new one.' }),
            };
        }

        // Clear OTP immediately to prevent reuse
        await admin.from('waitlist').update({ notes: null }).eq('id', wlUser.id);

        // 3. Find or create the auth user
        // IMPORTANT: Check public users table first to reuse their existing UUID.
        // This ensures orders/reviews (linked to the old UUID) still load correctly.
        let authUser = null;

        const { data: { users: allAuthUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 });
        authUser = allAuthUsers?.find(u => u.email === normalizedEmail) || null;

        if (!authUser) {
            // Check if there's an existing public user record with a specific UUID
            const { data: existingPublicUser } = await admin
                .from('users')
                .select('id')
                .eq('email', normalizedEmail)
                .maybeSingle();

            const createPayload = {
                email: normalizedEmail,
                email_confirm: true,
                user_metadata: { source: 'otp_login' },
            };

            // If public user exists, force the same UUID so all their data stays linked
            if (existingPublicUser?.id) {
                createPayload.id = existingPublicUser.id;
            }

            const { data: created, error: createErr } = await admin.auth.admin.createUser(createPayload);
            if (createErr) throw new Error('Failed to create auth user: ' + createErr.message);
            authUser = created.user;
        }

        // 4. Generate a magic link server-side, then immediately exchange it for session tokens
        //    using verifyOtp() on the anon client — no redirects, no expiry race conditions.
        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email: normalizedEmail,
        });
        if (linkErr) throw new Error('Failed to generate link: ' + linkErr.message);

        const hashedToken = linkData.properties.hashed_token;

        // Exchange hashed token for a real session server-side
        const { data: sessionData, error: sessionErr } = await anon.auth.verifyOtp({
            token_hash: hashedToken,
            type: 'magiclink',
        });
        if (sessionErr) throw new Error('Failed to exchange token: ' + sessionErr.message);

        // 5. Ensure public users table has a matching row for this auth user
        const { data: publicUser } = await admin
            .from('users')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (!publicUser) {
            await admin.from('users').upsert({
                id: authUser.id,
                email: normalizedEmail,
                trust_level: 'scout',
                report_count: 0,
                verified: false,
            });
        }

        // Return session tokens to the client — client calls db.auth.setSession()
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                ok: true,
                access_token: sessionData.session.access_token,
                refresh_token: sessionData.session.refresh_token,
                user: sessionData.session.user,
            }),
        };

    } catch (err) {
        console.error('verify-otp error:', err);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ ok: false, error: err.message }),
        };
    }
};
