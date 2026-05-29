const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pjygywbgwujkvpexmxuu.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeWd5d2Jnd3Vqa3ZwZXhteHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTg1OTgsImV4cCI6MjA5NDc3NDU5OH0.Z7P3Lzl9ye5XiEMOn2WTBh_8DJHd4QliUE5cbweag1c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        console.log("Checking Auth Users...");
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        if (error) throw error;
        
        const matched = users.find(u => u.email === 'kg819e@gmail.com');
        console.log("Matched Auth User:", matched);
    } catch (e) {
        console.error(e);
    }
}

check();
