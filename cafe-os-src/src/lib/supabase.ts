import { createClient } from '@supabase/supabase-js';

const IS_PROD = typeof window !== 'undefined'
  && window.location.hostname !== 'localhost'
  && window.location.hostname !== '127.0.0.1';

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeWd5d2Jnd3Vqa3ZwZXhteHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTg1OTgsImV4cCI6MjA5NDc3NDU5OH0.Z7P3Lzl9ye5XiEMOn2WTBh_8DJHd4QliUE5cbweag1c';

// HTTP requests go via Netlify proxy (bypasses ISP REST blocks)
// WebSocket MUST go directly to Supabase — Netlify proxies do NOT support WebSocket upgrades
const SUPABASE_URL = IS_PROD
  ? window.location.origin + '/supabase-api'
  : 'https://pjygywbgwujkvpexmxuu.supabase.co';

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    url: IS_PROD
      ? 'wss://pjygywbgwujkvpexmxuu.supabase.co/realtime/v1/websocket'
      : undefined,
    params: {
      apikey: SUPABASE_ANON_KEY,
    },
  },
});

