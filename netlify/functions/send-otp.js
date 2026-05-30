const { createClient } = require('@supabase/supabase-js');
const { Resend }       = require('resend');
const crypto           = require('crypto');

const db     = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const resend = new Resend(process.env.RESEND_API_KEY);

function cors(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors(200, { ok: true });
  if (event.httpMethod !== 'POST')    return cors(405, { ok: false, error: 'Method not allowed' });

  try {
    const { email } = JSON.parse(event.body || '{}');
    if (!email) return cors(400, { ok: false, error: 'Email required' });

    const normalizedEmail = email.trim().toLowerCase();

    // Generate 4-digit code
    const code    = String(Math.floor(1000 + Math.random() * 9000));
    const hash    = crypto.createHash('sha256')
                      .update(`${normalizedEmail}:${code}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`)
                      .digest('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Delete old OTPs for this email
    await db.from('otp_codes')
      .delete()
      .eq('email', normalizedEmail);

    // Store new OTP hash
    const { error: insertErr } = await db.from('otp_codes').insert({
      email:      normalizedEmail,
      code_hash:  hash,
      expires_at: expires,
      used:       false,
    });

    if (insertErr) throw new Error('Failed to store OTP: ' + insertErr.message);

    // Ensure auth user exists
    const { data: existingUser } = await db.auth.admin.getUserByEmail(normalizedEmail)
      .catch(() => ({ data: null }));

    if (!existingUser?.user) {
      const { error: createErr } = await db.auth.admin.createUser({
        email:         normalizedEmail,
        email_confirm: true,
        user_metadata: { source: 'otp_login' },
      });
      // Ignore "already exists" errors
      if (createErr && !createErr.message?.includes('already')) {
        throw new Error('Failed to create user: ' + createErr.message);
      }
    }

    // Send email
    const { error: mailErr } = await resend.emails.send({
      from:    `Snyf <${process.env.RESEND_FROM_EMAIL || 'hello@snyf.co.in'}>`,
      to:      normalizedEmail,
      subject: 'Your Snyf sign-in code',
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:32px auto;padding:28px;background:#F6F5F2;border-radius:16px;border:1px solid #E8E5DF;">
          <div style="font-size:22px;font-weight:900;color:#1E1E1B;margin-bottom:20px;">Snyf</div>
          <p style="font-size:14px;color:#6E6A64;margin-bottom:20px;">Your sign-in code. Valid for <strong>10 minutes</strong>.</p>
          <div style="font-size:42px;font-weight:800;font-family:monospace;letter-spacing:14px;padding:16px 20px;background:#fff;border:1.5px solid #D8D5CF;border-radius:10px;text-align:center;color:#6FB7D6;margin-bottom:20px;">
            ${code}
          </div>
          <p style="font-size:12px;color:#A59BB7;">If you didn't request this, ignore this email.</p>
        </div>`,
    });

    if (mailErr) throw new Error('Email failed: ' + mailErr.message);

    return cors(200, { ok: true });

  } catch (err) {
    console.error('[send-otp]', err.message);
    return cors(500, { ok: false, error: err.message });
  }
};
