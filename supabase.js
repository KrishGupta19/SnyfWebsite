const SNYF_URL = 'https://pjygywbgwujkvpexmxuu.supabase.co';
const SNYF_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeWd5d2Jnd3Vqa3ZwZXhteHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTg1OTgsImV4cCI6MjA5NDc3NDU5OH0.Z7P3Lzl9ye5XiEMOn2WTBh_8DJHd4QliUE5cbweag1c';

const { createClient } = supabase;
const db = createClient(SNYF_URL, SNYF_KEY);

function dbError(ctx, err) {
  console.error(`[Snyf DB] ${ctx}:`, err?.message || err);
}

function dbFallback(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = `
    <div style="text-align:center;padding:48px 20px;color:var(--muted,#6E6A64)">
      <div style="font-size:1.5rem;margin-bottom:10px">◈</div>
      <div style="font-weight:700;margin-bottom:4px">Could not load data</div>
      <div style="font-size:12px;opacity:.6">${msg || 'Check your connection and try again'}</div>
    </div>`;
}

function snyfSessionId() {
  let sid = sessionStorage.getItem('snyf_sid');
  if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem('snyf_sid', sid); }
  return sid;
}

function snyfTimeAgo(iso) {
  if (!iso) return '—';
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

// ── Auth helpers ──────────────────────────────────────────────

// Get current logged-in user (null if guest)
async function snyfGetUser() {
  try {
    const { data: { user } } = await db.auth.getUser();
    return user || null;
  } catch { return null; }
}

// Get user profile from users table
async function snyfGetProfile(userId) {
  try {
    const { data } = await db
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return data || null;
  } catch { return null; }
}

// Sign in with email or phone OTP via Supabase Edge Functions
async function snyfSignInOTP(emailOrPhone) {
  try {
    const isPhone = !emailOrPhone.includes('@');
    const payload = isPhone ? { phone: emailOrPhone } : { email: emailOrPhone };
    const res = await fetch(`${SNYF_URL}/functions/v1/send-otp`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SNYF_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Failed to send OTP' };
    }
    return { ok: true, debugOtp: data.debugOtp };
  } catch (err) {
    console.error('snyfSignInOTP error:', err);
    return { ok: false, error: err.message || 'Network error' };
  }
}

async function snyfVerifyOTP(emailOrPhone, token) {
  try {
    const isPhone = !emailOrPhone.includes('@');
    const payload = isPhone ? { phone: emailOrPhone, token } : { email: emailOrPhone, token };
    const res = await fetch(`${SNYF_URL}/functions/v1/verify-otp`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SNYF_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { user: null, error: new Error(data.error || 'Invalid or expired OTP') };
    }
    if (data.access_token && data.refresh_token) {
      const { data: sessionData, error: sessionErr } = await db.auth.setSession({
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionErr) return { user: null, error: sessionErr };
      return { user: sessionData.user, error: null };
    }
    return { user: null, error: new Error('Session establishment failed') };
  } catch (err) {
    console.error('snyfVerifyOTP error:', err);
    return { user: null, error: err };
  }
}

// Sign out
async function snyfSignOut() {
  await db.auth.signOut();
}

// Listen for auth state changes
function snyfOnAuthChange(callback) {
  return db.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
}

// Compute trust level silently (never shown to user yet)
async function recomputeTrustLevel(userId) {
  try {
    const { data: reports } = await db
      .from('field_reports')
      .select('verified, flagged, venue_id, created_at')
      .eq('user_id', userId);

    if (!reports || reports.length === 0) return 'scout';

    const total      = reports.length;
    const verified   = reports.filter(r => r.verified).length;
    const flagged    = reports.filter(r => r.flagged).length;
    const venues     = new Set(reports.map(r => r.venue_id).filter(Boolean)).size;
    const { data: userRow } = await db
      .from('users')
      .select('created_at')
      .eq('id', userId)
      .single();

    const ageDays = userRow
      ? Math.floor((Date.now() - new Date(userRow.created_at)) / 86400000)
      : 0;

    // Recent flagged (last 30 days)
    const thirtyDaysAgo  = new Date(Date.now() - 30 * 86400000);
    const recentFlagged  = reports.filter(r =>
      r.flagged && new Date(r.created_at) > thirtyDaysAgo
    ).length;

    let level = 'scout';

    if (total >= 3 && ageDays >= 7 && verified >= 1) {
      level = 'explorer';
    }
    if (total >= 10 && ageDays >= 30 && verified >= 5 && recentFlagged === 0 && venues >= 2) {
      level = 'verified';
    }
    if (total >= 25 && ageDays >= 90 && verified >= 15 && flagged === 0 && venues >= 5) {
      level = 'anchor';
    }

    // Update silently
    await db.from('users').update({ trust_level: level }).eq('id', userId);
    return level;

  } catch { return 'scout'; }
}
