const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pjygywbgwujkvpexmxuu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeWd5d2Jnd3Vqa3ZwZXhteHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTg1OTgsImV4cCI6MjA5NDc3NDU5OH0.Z7P3Lzl9ye5XiEMOn2WTBh_8DJHd4QliUE5cbweag1c';
const db = createClient(supabaseUrl, supabaseKey);

const testUserId = '48e49741-bd76-4cac-aea7-7f18dfacf104';

async function test() {
    try {
        console.log("1. Running snyfGetProfile...");
        const { data: profile, error: pErr } = await db
            .from('users')
            .select('*')
            .eq('id', testUserId)
            .single();
        console.log("Profile fetched:", profile, "Error:", pErr);

        console.log("2. Running loadOrders...");
        const { data: orders, error: oErr } = await db
            .from('orders')
            .select('*, venues(name, slug)')
            .eq('user_id', testUserId)
            .order('created_at', { ascending: false });
        console.log("Orders fetched count:", orders?.length, "Error:", oErr);

        console.log("3. Running loadReviews...");
        const { data: reviews, error: rErr } = await db
            .from('field_reports')
            .select('*')
            .eq('user_id', testUserId)
            .order('created_at', { ascending: false });
        console.log("Reviews fetched count:", reviews?.length, "Error:", rErr);

    } catch (e) {
        console.error("CRASHED:", e);
    }
}

test();
