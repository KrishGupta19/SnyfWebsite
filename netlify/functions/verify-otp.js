const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
        const { data: wlUser, error: wlErr } = await supabase
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

        // OTP is correct! Clear it from notes so it can't be reused
        await supabase
            .from('waitlist')
            .update({ notes: null })
            .eq('id', wlUser.id);

        // Determine redirect origin (default to snyf.co.in if not available)
        let origin = event.headers.origin || event.headers.referer;
        if (origin) {
            try {
                const parsed = new URL(origin);
                origin = parsed.origin;
            } catch (e) {
                // Not a valid URL, ignore
            }
        }
        if (!origin || origin === 'null') {
            origin = 'https://snyf.co.in';
        }

        // 3. Ensure the user exists in Supabase Auth (auth.users)
        // Check public users table
        const { data: dbUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (!dbUser) {
            // Create user in Supabase Auth (this triggers profile creation in users table)
            const { data: authUser, error: createErr } = await supabase.auth.admin.createUser({
                email: normalizedEmail,
                email_confirm: true
            });
            if (createErr && !createErr.message.includes('already exists')) {
                throw new Error('Failed to register user in Auth: ' + createErr.message);
            }
        }

        // 4. Generate Magic Link to log the user in via GoTrue
        const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: normalizedEmail,
            options: {
                redirectTo: `${origin}/profile.html`
            }
        });

        if (linkErr) {
            throw new Error('Failed to generate secure session: ' + linkErr.message);
        }

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                ok: true, 
                actionLink: linkData.properties.action_link 
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
