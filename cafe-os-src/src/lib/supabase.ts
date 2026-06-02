import { createClient } from '@supabase/supabase-js';

// Use the direct Supabase URL always.
// The Netlify proxy (/supabase-api/*) cannot handle WebSocket upgrades,
// so using it here would break Supabase Realtime. The proxy is only used
// in the static HTML pages (supabase.js) for REST calls on ISP-blocked networks.
const SUPABASE_URL     = 'https://pjygywbgwujkvpexmxuu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeWd5d2Jnd3Vqa3ZwZXhteHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTg1OTgsImV4cCI6MjA5NDc3NDU5OH0.Z7P3Lzl9ye5XiEMOn2WTBh_8DJHd4QliUE5cbweag1c';

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

