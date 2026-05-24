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

-- RLS: users can read their own orders
create policy "users_read_own_orders"
  on orders for select
  using (auth.uid() = user_id OR user_id IS NULL);

-- RLS: users can read their own field reports
create policy "users_read_own_reports"
  on field_reports for select
  using (auth.uid() = user_id OR user_id IS NULL);
