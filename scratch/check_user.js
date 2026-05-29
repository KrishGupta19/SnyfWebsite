const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pjygywbgwujkvpexmxuu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeWd5d2Jnd3Vqa3ZwZXhteHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTg1OTgsImV4cCI6MjA5NDc3NDU5OH0.Z7P3Lzl9ye5XiEMOn2WTBh_8DJHd4QliUE5cbweag1c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        console.log("Checking waitlist...");
        const { data: wlData, error: wlErr } = await supabase
            .from('waitlist')
            .select('*')
            .eq('email', 'kg819e@gmail.com')
            .maybeSingle();
        console.log("Waitlist entry:", wlData, "Error:", wlErr);

        console.log("Checking users...");
        const { data: userData, error: userErr } = await supabase
            .from('users')
            .select('*')
            .eq('email', 'kg819e@gmail.com')
            .maybeSingle();
        console.log("Users entry:", userData, "Error:", userErr);
    } catch (e) {
        console.error(e);
    }
}

check();
