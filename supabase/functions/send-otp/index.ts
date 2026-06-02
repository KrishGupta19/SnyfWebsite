import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend }       from 'https://esm.sh/resend@2';

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

async function sendTwilioSMS(to: string, code: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER');

  if (!accountSid || !authToken || !fromNumber) return false;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: to,
    From: fromNumber,
    Body: `Your Snyf verification code is: ${code}. Valid for 10 minutes.`,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Twilio error: ${response.status} - ${errText}`);
  }

  console.log(`[Twilio] SMS successfully sent to ${to}`);
  return true;
}

async function sendMSG91SMS(to: string, code: string) {
  const authKey = Deno.env.get('MSG91_AUTH_KEY');
  const templateId = Deno.env.get('MSG91_TEMPLATE_ID');

  if (!authKey || !templateId) return false;

  const mobile = to.replace('+', '');
  
  const response = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authkey': authKey,
    },
    body: JSON.stringify({
      template_id: templateId,
      mobile: mobile,
      otp: code,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`MSG91 error: ${response.status} - ${errText}`);
  }

  console.log(`[MSG91] SMS successfully sent to ${to}`);
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')   return res(405, { ok: false, error: 'Method not allowed' });

  try {
    const { email, phone } = await req.json();
    const input = (email || phone || '').trim();
    if (!input) return res(400, { ok: false, error: 'Email or phone required' });

    const isPhone = !input.includes('@');
    const normalizedIdentifier = isPhone ? input : input.toLowerCase();

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey      = Deno.env.get('RESEND_API_KEY')!;
    const fromEmail      = Deno.env.get('RESEND_FROM_EMAIL') || 'hello@snyf.co.in';

    if (!supabaseUrl || !serviceRoleKey || !resendKey) {
      throw new Error('Edge function not configured correctly.');
    }

    const db     = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const resend = new Resend(resendKey);

    // Generate 4-digit code
    const code    = String(Math.floor(1000 + Math.random() * 9000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Hash code using Web Crypto API (Deno built-in)
    const encoder  = new TextEncoder();
    const hashBuf  = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(`${normalizedIdentifier}:${code}:${serviceRoleKey}`)
    );
    const hash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Parallelized Database operations and Resend Email dispatch
    const dbWritePromise = (async () => {
      // 1. Delete old OTPs for this identifier
      await db.from('otp_codes').delete().eq('email', normalizedIdentifier);

      // 2. Store new OTP hash
      const { error: insertErr } = await db.from('otp_codes').insert({
        email:      normalizedIdentifier,
        code_hash:  hash,
        expires_at: expires,
        used:       false,
      });
      if (insertErr) throw new Error('Failed to store OTP: ' + insertErr.message);
    })();

    let debugOtp: string | undefined = undefined;

    if (isPhone) {
      let smsSent = false;
      try {
        smsSent = await sendTwilioSMS(normalizedIdentifier, code);
        if (!smsSent) {
          smsSent = await sendMSG91SMS(normalizedIdentifier, code);
        }
      } catch (smsErr: any) {
        console.error('[SMS Send Error]', smsErr.message);
      }

      if (!smsSent) {
        console.log(`[SMS OTP Fallback] Code for ${normalizedIdentifier} is ${code}`);
        debugOtp = code;
      }
      await dbWritePromise;
    } else {
      const mailPromise = resend.emails.send({
        from:    `Snyf <${fromEmail}>`,
        to:      normalizedIdentifier,
        subject: 'Your Snyf sign-in code',
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:420px;margin:32px auto;padding:28px;background:#F6F5F2;border-radius:16px;border:1px solid #E8E5DF;">
            <div style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#1E1E1B;margin-bottom:20px;">Snyf</div>
            <p style="font-size:14px;color:#6E6A64;line-height:1.6;margin-bottom:20px;">
              Your sign-in code. Valid for <strong>10 minutes</strong>. Do not share this.
            </p>
            <div style="font-size:44px;font-weight:800;font-family:monospace;letter-spacing:18px;padding:18px 20px 18px 32px;background:#ffffff;border:2px solid #D8D5CF;border-radius:12px;text-align:center;color:#6FB7D6;margin-bottom:24px;">
              ${code}
            </div>
            <p style="font-size:12px;color:#A59BB7;line-height:1.5;">
              If you did not request this, you can safely ignore this email.
            </p>
            <hr style="border:none;border-top:1px solid #D8D5CF;margin:20px 0 14px;">
            <p style="font-size:11px;color:#6E6A64;font-family:monospace;margin:0;">— The Snyf Team</p>
          </div>`,
      });

      const [_, mailRes] = await Promise.all([dbWritePromise, mailPromise]);
      if (mailRes.error) throw new Error('Email send failed: ' + mailRes.error.message);
    }

    return res(200, { ok: true, debugOtp });

  } catch (err: any) {
    console.error('[send-otp]', err.message);
    return res(500, { ok: false, error: err.message });
  }
});
