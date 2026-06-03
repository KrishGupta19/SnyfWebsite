-- Link users table to Supabase Auth
alter table users
  add column if not exists id uuid references auth.users(id) on delete cascade,
  add column if not exists phone text,
  add column if not exists name  text;

-- Add user_id to field_reports so reviews link to accounts
alter table field_reports
  add column if not exists user_id uuid references auth.users(id);

-- Add user_id to orders so order history links to accounts
alter table orders
  add column if not exists user_id uuid references auth.users(id);

-- Auto-create user profile when someone signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, trust_level, report_count, verified)
  values (
    new.id,
    new.email,
    'scout',
    0,
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: runs after every new Supabase Auth signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS: users can read/update their own profile
create policy "users_read_own"
  on users for select
  using (auth.uid() = id);

create policy "users_update_own"
  on users for update
  using (auth.uid() = id);

drop policy if exists "users_insert_own" on users;
create policy "users_insert_own"
  on users for insert
  with check (auth.uid() = id);

-- RLS: users can read their own orders
create policy "users_read_own_orders"
  on orders for select
  using (auth.uid() = user_id OR user_id IS NULL);

-- RLS: users can read their own field reports
create policy "users_read_own_reports"
  on field_reports for select
  using (auth.uid() = user_id OR user_id IS NULL);

-- Add password column to users table
alter table public.users add column if not exists password text;

-- OTP storage table (replaces app_metadata approach)
create table if not exists otp_codes (
  id         uuid default gen_random_uuid() primary key,
  email      text not null,
  code_hash  text not null,
  expires_at timestamptz not null,
  used       boolean default false,
  created_at timestamptz default now()
);

-- Only keep latest OTP per email
create index if not exists otp_email_idx on otp_codes (email);

-- Auto-delete expired codes after 1 hour
alter table otp_codes enable row level security;

-- Service role only — never exposed to browser
create policy "svc_otp_codes"
  on otp_codes for all using (true);

-- ── Time-based item availability ──────────────────────────────────────────────
-- Stored as "HH:MM" strings in IST (e.g. "08:00", "14:00").
-- NULL means available all day (no time restriction).
alter table menu_items
  add column if not exists available_from text default null,
  add column if not exists available_until text default null;

-- Add CGST, SGST, and Service Tax percentage columns to venues table
alter table venues
  add column if not exists cgst_pct numeric default 0,
  add column if not exists sgst_pct numeric default 0,
  add column if not exists service_tax_pct numeric default 0;
