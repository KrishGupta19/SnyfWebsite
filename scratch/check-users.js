const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const db = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await db.from('users').select('*').limit(1);
  console.log('Error:', error);
  console.log('Data:', data);
}

check();
