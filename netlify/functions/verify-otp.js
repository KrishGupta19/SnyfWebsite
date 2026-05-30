const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

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

function hashOtp(email, otp) {
    return crypto
        .createHash('sha256')
        .update(`${email}:${otp}:${serviceRoleKey}`)
        .digest('hex');
}

async function findAuthUserByEmail(email) {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    return users?.find(user => user.email?.toLowerCase() === email) || null;
}

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

        if (!supabaseUrl || !serviceRoleKey || !anonKey) {
            throw new Error('OTP service is not configured correctly.');
        }

        // 1. Find the auth user and validate the OTP stored by send-otp.
        let authUser = await findAuthUserByEmail(normalizedEmail);

        if (!authUser?.app_metadata?.snyf_otp_hash || !authUser?.app_metadata?.snyf_otp_expires_at) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ ok: false, error: 'No active OTP request found for this email.' }),
            };
        }

        if (authUser.app_metadata.snyf_otp_hash !== hashOtp(normalizedEmail, otpToken)) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ ok: false, error: 'Invalid verification code. Please try again.' }),
            };
        }

        if (Date.now() > new Date(authUser.app_metadata.snyf_otp_expires_at).getTime()) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ ok: false, error: 'Verification code has expired. Please request a new one.' }),
            };
        }

        // Clear OTP immediately to prevent reuse.
        await admin.auth.admin.updateUserById(authUser.id, {
            app_metadata: {
                ...(authUser.app_metadata || {}),
                snyf_otp_hash: null,
                snyf_otp_expires_at: null,
            },
        });

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
            .select('id, trust_level, report_count, verified')
            .eq('email', normalizedEmail)
            .maybeSingle();

        await admin.from('users').upsert({
            id: authUser.id,
            email: normalizedEmail,
            trust_level: publicUser?.trust_level || 'scout',
            report_count: publicUser?.report_count || 0,
            verified: publicUser?.verified || false,
        }, { onConflict: 'id' });

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
