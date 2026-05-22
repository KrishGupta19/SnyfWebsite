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
