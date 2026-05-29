const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  console.log("Querying users table...");
  const { data, error } = await db.from('users').select('*').limit(5);
  if (error) {
    console.error("Error querying users table:", error);
  } else {
    console.log("Success! Columns in users table:", Object.keys(data[0] || {}));
    console.log("Rows:", data);
  }
}

run();
