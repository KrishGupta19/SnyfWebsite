import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://pjygywbgwujkvpexmxuu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeWd5d2Jnd3Vqa3ZwZXhteHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTg1OTgsImV4cCI6MjA5NDc3NDU5OH0.Z7P3Lzl9ye5XiEMOn2WTBh_8DJHd4QliUE5cbweag1c';

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('Inserting test order...');
  const { data: insertData, error: insertError } = await db.from('orders').insert({
    venue_id: 'bac97f95-403c-4617-a135-134b34220025',
    items: [],
    subtotal: 0,
    gst: 0,
    service_charge: 0,
    total: 0,
    status: 'completed', // Let's test if 'completed' works!
  }).select();

  if (insertError) {
    console.error('Error inserting completed status:', insertError);
  } else {
    console.log('Successfully inserted order with status completed:', insertData);
    // clean up
    const { error: deleteError } = await db.from('orders').delete().eq('id', insertData[0].id);
    console.log('Cleanup delete error:', deleteError);
  }
}
run();
