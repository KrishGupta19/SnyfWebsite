const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SNYF_URL = 'https://pjygywbgwujkvpexmxuu.supabase.co';
const SNYF_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeWd5d2Jnd3Vqa3ZwZXhteHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTg1OTgsImV4cCI6MjA5NDc3NDU5OH0.Z7P3Lzl9ye5XiEMOn2WTBh_8DJHd4QliUE5cbweag1c';

const db = createClient(SNYF_URL, SNYF_KEY);

async function main() {
  console.log('Querying venues...');
  const { data: venues, error: vErr } = await db.from('venues').select('*');
  if (vErr) {
    console.error('Venues Error:', vErr);
  } else {
    console.log('Venues:', venues);
  }

  console.log('Querying venue_credentials...');
  const { data: credentials, error: cErr } = await db.from('venue_credentials').select('*');
  if (cErr) {
    console.error('Credentials Error:', cErr);
  } else {
    console.log('Credentials:', credentials);
  }
}

main();
