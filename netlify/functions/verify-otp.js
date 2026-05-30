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
  try {
    const { data, error } = await admin.auth.admin.getUserByEmail(email);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

// Wrap handler with 9-second timeout (Netlify free = 10s limit)
async function handleRequest(event) {
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

        // Fast lookup — getUserByEmail instead of listUsers scan
        let authUser = await findAuthUserByEmail(normalizedEmail);

        if (!authUser?.app_metadata?.snyf_otp_hash || !authUser?.app_metadata?.snyf_otp_expires_at) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ ok: false, error: 'No active OTP found. Please request a new code.' }),
            };
        }

        if (authUser.app_metadata.snyf_otp_hash !== hashOtp(normalizedEmail, otpToken)) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ ok: false, error: 'Invalid code. Please try again.' }),
            };
        }

        if (Date.now() > new Date(authUser.app_metadata.snyf_otp_expires_at).getTime()) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ ok: false, error: 'Code has expired. Please request a new one.' }),
            };
        }

        // Clear OTP — fire and forget, don't await (saves ~300ms)
        admin.auth.admin.updateUserById(authUser.id, {
            app_metadata: {
                ...authUser.app_metadata,
                snyf_otp_hash: null,
                snyf_otp_expires_at: null,
            },
        }).catch(err => console.warn('OTP clear warning:', err.message));

        // Generate session
        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email: normalizedEmail,
        });
        if (linkErr) throw new Error('Failed to generate link: ' + linkErr.message);

        const { data: sessionData, error: sessionErr } = await anon.auth.verifyOtp({
            token_hash: linkData.properties.hashed_token,
            type: 'magiclink',
        });
        if (sessionErr) throw new Error('Failed to exchange token: ' + sessionErr.message);

        // Upsert public users row — fire and forget (don't block session return)
        admin.from('users').upsert({
            id:           authUser.id,
            email:        normalizedEmail,
            trust_level:  'scout',
            report_count: 0,
            verified:     false,
        }, { onConflict: 'id', ignoreDuplicates: true })
        .catch(err => console.warn('Users upsert warning:', err.message));

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                ok:            true,
                access_token:  sessionData.session.access_token,
                refresh_token: sessionData.session.refresh_token,
                user:          sessionData.session.user,
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
}

exports.handler = (event) => {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Function timeout — please try again')), 9000)
    );
    return Promise.race([handleRequest(event), timeout]).catch(err => ({
        statusCode: 500,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ ok: false, error: err.message }),
    }));
};
