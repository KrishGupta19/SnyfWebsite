const { createClient } = require('@supabase/supabase-js');
const { Resend }       = require('resend');
const crypto           = require('crypto');

const supabaseUrl  = process.env.SUPABASE_URL;
const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase     = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const resend       = new Resend(process.env.RESEND_API_KEY);

function hashOtp(email, otp) {
  return crypto
    .createHash('sha256')
    .update(`${email}:${otp}:${supabaseKey}`)
    .digest('hex');
}

// Fast lookup — tries getUserByEmail first, falls back to listUsers
async function findAuthUserByEmail(email) {
  // Method 1: direct lookup (fast)
  try {
    const { data, error } = await supabase.auth.admin.getUserByEmail(email);
    if (!error && data?.user) return data.user;
  } catch (e) {
    console.warn('getUserByEmail not available, falling back:', e.message);
  }

  // Method 2: fallback scan (slower but always works)
  try {
    let page = 1;
    while (true) {
      const { data: { users }, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error || !users?.length) break;
      const found = users.find(u => u.email?.toLowerCase() === email);
      if (found) return found;
      if (users.length < 1000) break;
      page++;
    }
  } catch (e) {
    console.warn('listUsers fallback failed:', e.message);
  }

  return null;
}

async function getOrCreateAuthUser(email) {
  // First try to find existing user
  let authUser = await findAuthUserByEmail(email);
  if (authUser) return authUser;

  // User doesn't exist — create them
  try {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { source: 'otp_login' },
    });

    if (createErr) {
      // If "already registered" error, try finding again
      // (race condition — created between our check and create)
      if (
        createErr.message?.includes('already been registered') ||
        createErr.message?.includes('already exists') ||
        createErr.status === 422
      ) {
        authUser = await findAuthUserByEmail(email);
        if (authUser) return authUser;
      }
      throw createErr;
    }

    return created.user;

  } catch (err) {
    throw new Error('Failed to prepare login: ' + err.message);
  }
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
    const { email } = JSON.parse(event.body || '{}');

    if (!email) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: false, error: 'Email is required' }),
      };
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!supabaseUrl || !supabaseKey || !process.env.RESEND_API_KEY) {
      throw new Error('OTP service is not configured correctly.');
    }

    // Generate 4-digit OTP
    const otp    = Math.floor(1000 + Math.random() * 9000).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Get or create auth user — handles existing users correctly
    const authUser = await getOrCreateAuthUser(normalizedEmail);

    // Store hashed OTP in app_metadata
    const { error: otpErr } = await supabase.auth.admin.updateUserById(authUser.id, {
      app_metadata: {
        ...(authUser.app_metadata || {}),
        snyf_otp_hash:       hashOtp(normalizedEmail, otp),
        snyf_otp_expires_at: expiry,
      },
    });

    if (otpErr) throw new Error('Failed to save OTP: ' + otpErr.message);

    // Send email
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'hello@snyf.co.in';
    const { error: mailErr } = await resend.emails.send({
      from:    `Snyf <${fromEmail}>`,
      to:      normalizedEmail,
      subject: 'Your Snyf Verification Code',
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:40px auto;padding:32px;border:1px solid #E8E5DF;border-radius:20px;background:#F6F5F2;">
          <div style="font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#1E1E1B;margin-bottom:24px;">Snyf</div>
          <h2 style="font-size:20px;font-weight:800;color:#1E1E1B;margin-bottom:8px;">Your sign-in code</h2>
          <p style="font-size:14px;line-height:1.6;color:#6E6A64;margin-bottom:24px;">
            Valid for <strong>5 minutes</strong>. Do not share this code.
          </p>
          <div style="background:rgba(255,255,255,0.8);border:1.5px solid #D8D5CF;border-radius:12px;padding:16px;font-size:40px;font-family:monospace;font-weight:800;letter-spacing:16px;padding-left:28px;text-align:center;margin-bottom:24px;color:#6FB7D6;">
            ${otp}
          </div>
          <p style="font-size:12px;color:#A59BB7;line-height:1.5;">
            If you did not request this, ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid #D8D5CF;margin:24px 0 16px;" />
          <p style="font-size:11px;color:#6E6A64;font-family:monospace;">— The Snyf Team</p>
        </div>`,
    });

    if (mailErr) throw new Error('Email send failed: ' + mailErr.message);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ ok: true }),
    };

  } catch (err) {
    console.error('send-otp error:', err);
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
