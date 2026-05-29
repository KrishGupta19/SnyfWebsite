const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const resend = new Resend(process.env.RESEND_API_KEY);

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
        const { email } = JSON.parse(event.body);
        if (!email) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ ok: false, error: 'Email is required' }),
            };
        }

        const normalizedEmail = email.trim().toLowerCase();

        // 1. Check if user is in waitlist or registered users
        const { data: wlUser, error: wlErr } = await supabase
            .from('waitlist')
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();

        const { data: dbUser, error: dbErr } = await supabase
            .from('users')
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (!wlUser && !dbUser) {
            return {
                statusCode: 403,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ 
                    ok: false, 
                    error: 'Your email is not on the waitlist. Please register on the homepage waitlist first!' 
                }),
            };
        }

        // 2. Generate 4-digit OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes validity

        // 3. Store OTP in waitlist table's notes column
        if (wlUser) {
            const { error: updateErr } = await supabase
                .from('waitlist')
                .update({ notes: `otp:${otp}:${expiry}` })
                .eq('id', wlUser.id);
            if (updateErr) throw new Error('Failed to save OTP to waitlist: ' + updateErr.message);
        } else {
            const { error: insertErr } = await supabase
                .from('waitlist')
                .insert({
                    email: normalizedEmail,
                    name: dbUser.name || '',
                    type: 'user',
                    status: 'new',
                    notes: `otp:${otp}:${expiry}`,
                    source: 'login_otp'
                });
            if (insertErr) throw new Error('Failed to register login session: ' + insertErr.message);
        }

        // 4. Send Email via Resend
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'hello@snyf.co.in';
        const { data, error: mailErr } = await resend.emails.send({
            from: `Snyf <${fromEmail}>`,
            to: normalizedEmail,
            subject: "Your Snyf Verification Code",
            html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 40px auto; padding: 32px; border: 1px solid #E8E5DF; border-radius: 20px; background: #F6F5F2; box-shadow: 0 8px 30px rgba(30,30,27,0.04);">
                <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #1E1E1B; margin-bottom: 24px; font-family: 'Oswald', sans-serif;">Snyf</div>
                <h2 style="font-size: 20px; font-weight: 800; color: #1E1E1B; margin-bottom: 8px;">Verify your identity</h2>
                <p style="font-size: 14px; line-height: 1.6; color: #6E6A64; margin-bottom: 24px;">Use this single-use verification code to securely access your Snyf account. This code is valid for 5 minutes.</p>
                <div style="background: rgba(255,255,255,0.8); border: 1.5px solid #D8D5CF; border-radius: 12px; padding: 16px; font-size: 36px; font-family: monospace; font-weight: 800; letter-spacing: 12px; padding-left: 24px; text-align: center; margin-bottom: 24px; color: #6FB7D6; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">${otp}</div>
                <p style="font-size: 12px; color: #A59BB7; line-height: 1.5;">If you did not request this code, you can safely ignore this email. Someone else may have typed your email address by mistake.</p>
                <hr style="border: none; border-top: 1px solid #D8D5CF; margin: 24px 0 16px;" />
                <p style="font-size: 11px; color: #6E6A64; font-family: monospace;">— The Snyf Team</p>
            </div>
            `,
        });

        if (mailErr) {
            throw new Error('Resend error: ' + mailErr.message);
        }

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ ok: true }),
        };

    } catch (err) {
        console.error('send-otp error:', err);
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
