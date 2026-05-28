import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://pjygywbgwujkvpexmxuu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeWd5d2Jnd3Vqa3ZwZXhteHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTg1OTgsImV4cCI6MjA5NDc3NDU5OH0.Z7P3Lzl9ye5XiEMOn2WTBh_8DJHd4QliUE5cbweag1c';

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data: reviews, error } = await db.from('field_reports').select('*').eq('venue_id', '94991de2-f597-4b73-a85a-9e1fe0ef8927');
  if (error) {
    console.error('Error fetching reviews:', error);
  } else {
    console.log('Reviews found:', reviews.length);
    console.log('Reviews details:', reviews);
  }
}
run();
