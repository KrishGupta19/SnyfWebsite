const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
});

exports.handler = async (event) => {
    // Enable CORS
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
        return { 
            statusCode: 405, 
            body: 'Method Not Allowed' 
        };
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

        // 1. Fetch waitlist record to get the stored OTP
        const { data: wlUser } = await supabase
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

        // Parse stored OTP: "otp:CODE:EXPIRY"
        const parts = wlUser.notes.split(':');
        const storedCode = parts[1];
        const expiry = parseInt(parts[2], 10);

        // 2. Validate OTP code
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

        // OTP is correct! Clear it from notes immediately so it can't be reused
        await supabase
            .from('waitlist')
            .update({ notes: null })
            .eq('id', wlUser.id);

        // 3. Get or create the Supabase Auth user
        let authUserId = null;

        // Try to find existing auth user by email
        const { data: { users: existingUsers } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existingAuthUser = existingUsers?.find(u => u.email === normalizedEmail);

        if (existingAuthUser) {
            authUserId = existingAuthUser.id;
        } else {
            // Create new auth user with email confirmed
            const { data: newAuthUser, error: createErr } = await supabase.auth.admin.createUser({
                email: normalizedEmail,
                email_confirm: true,
                user_metadata: { source: 'otp_login' }
            });

            if (createErr) {
                throw new Error('Failed to create auth user: ' + createErr.message);
            }
            authUserId = newAuthUser.user.id;
        }

        // 4. Create a real session directly (no magic links, no redirects, no expiry race conditions)
        const { data: sessionData, error: sessionErr } = await supabase.auth.admin.createSession({
            user_id: authUserId
        });

        if (sessionErr) {
            throw new Error('Failed to create session: ' + sessionErr.message);
        }

        // 5. Return session tokens to the client directly
        // The client will call db.auth.setSession() with these tokens — instant, reliable login
        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
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
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ ok: false, error: err.message }),
        };
    }
};
