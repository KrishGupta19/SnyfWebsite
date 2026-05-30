-- ── Database indexes for scale ────────────────────────────────
create index if not exists idx_orders_venue_status
  on orders (venue_id, status, created_at desc)
  where status != 'delivered';

create index if not exists idx_orders_user_id
  on orders (user_id, created_at desc);

create index if not exists idx_orders_venue_created
  on orders (venue_id, created_at desc);

create index if not exists idx_reports_venue_id
  on field_reports (venue_id, created_at desc);

create index if not exists idx_reports_user_id
  on field_reports (user_id, created_at desc);

create index if not exists idx_qr_venue_table
  on qr_codes (venue_id, table_num)
  where active = true;

create index if not exists idx_venues_slug
  on venues (slug)
  where status = 'active';

create index if not exists idx_otp_email_active
  on otp_codes (email, expires_at)
  where used = false;

create index if not exists idx_menu_venue
  on menu_items (venue_id, sort_order)
  where available = true;

-- ── Tighten RLS policies ──────────────────────────────────────

-- Orders: only insert for active venues
drop policy if exists "pub_insert_orders" on orders;
create policy "pub_insert_orders"
  on orders for insert
  with check (
    exists (
      select 1 from venues
      where id = venue_id
      and status = 'active'
    )
  );

-- Field reports: venue must exist if specified
drop policy if exists "pub_insert_reports"   on field_reports;
drop policy if exists "pub_write_reports"    on field_reports;
create policy "pub_insert_reports"
  on field_reports for insert
  with check (
    venue_id is null or
    exists (
      select 1 from venues
      where id = venue_id
    )
  );
