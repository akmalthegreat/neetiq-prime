-- Phase 3: Premium Batches, Coupons, Order Summary, Admin Grants
-- Applied directly to user's custom Supabase via psql (not Lovable Cloud).

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text,
  price numeric(10,2) not null check (price >= 0),
  discounted_price numeric(10,2) not null check (discounted_price >= 0),
  duration_days integer not null default 30 check (duration_days > 0),
  features jsonb not null default '{}'::jsonb,
  ai_description text,
  short_tagline text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.batches to anon, authenticated;
grant all on public.batches to service_role;
alter table public.batches enable row level security;
drop policy if exists batches_public_read on public.batches;
create policy batches_public_read on public.batches for select using (active = true);
drop policy if exists batches_admin_all on public.batches;
create policy batches_admin_all on public.batches for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('percent','flat')),
  value numeric(10,2) not null check (value >= 0),
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  batch_id uuid references public.batches(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists coupons_code_idx on public.coupons (lower(code));
grant select on public.coupons to authenticated;
grant all on public.coupons to service_role;
alter table public.coupons enable row level security;
drop policy if exists coupons_admin_all on public.coupons;
create policy coupons_admin_all on public.coupons for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists coupons_user_select on public.coupons;
create policy coupons_user_select on public.coupons for select to authenticated using (active = true);

create table if not exists public.batch_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete restrict,
  coupon_id uuid references public.coupons(id) on delete set null,
  amount_paid numeric(10,2) not null,
  mrp numeric(10,2) not null,
  discount_amount numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','active','failed','refunded')),
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz not null default now()
);
create index if not exists batch_purchases_user_idx on public.batch_purchases (user_id, status);
grant select on public.batch_purchases to authenticated;
grant all on public.batch_purchases to service_role;
alter table public.batch_purchases enable row level security;
drop policy if exists bp_self_read on public.batch_purchases;
create policy bp_self_read on public.batch_purchases for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid references public.batch_purchases(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (coupon_id, user_id)
);
grant select on public.coupon_redemptions to authenticated;
grant all on public.coupon_redemptions to service_role;
alter table public.coupon_redemptions enable row level security;
drop policy if exists cr_self_read on public.coupon_redemptions;
create policy cr_self_read on public.coupon_redemptions for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

alter table public.subscriptions
  add column if not exists source text default 'plan',
  add column if not exists source_batch_id uuid references public.batches(id) on delete set null,
  add column if not exists granted_by uuid references auth.users(id) on delete set null;

alter table public.payment_orders
  add column if not exists batch_id uuid references public.batches(id) on delete set null,
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null,
  add column if not exists discount_amount numeric(10,2) default 0;

-- Add 'batch' to purpose enum if it's a check constraint string
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='payment_orders' and column_name='purpose'
  ) then
    -- best-effort: drop and recreate check to include 'batch'
    begin
      alter table public.payment_orders drop constraint if exists payment_orders_purpose_check;
      alter table public.payment_orders add constraint payment_orders_purpose_check
        check (purpose in ('deposit','bonus','subscription','batch'));
    exception when others then null;
    end;
  end if;
end$$;

insert into public.app_settings (key, value)
values ('bonus_suspended', 'true'::jsonb)
on conflict (key) do nothing;

insert into storage.buckets (id, name, public)
values ('batch-images', 'batch-images', true)
on conflict (id) do nothing;

drop policy if exists "batch_images_public_read" on storage.objects;
create policy "batch_images_public_read" on storage.objects for select
  using (bucket_id = 'batch-images');

drop policy if exists "batch_images_admin_write" on storage.objects;
create policy "batch_images_admin_write" on storage.objects for all to authenticated
  using (bucket_id = 'batch-images' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'batch-images' and public.has_role(auth.uid(), 'admin'));

create or replace function public.admin_grant_premium(_user_id uuid, _days integer, _note text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  _expires timestamptz;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Forbidden';
  end if;
  _expires := now() + make_interval(days => _days);
  insert into public.subscriptions (user_id, plan, status, started_at, expires_at, source, granted_by)
  values (_user_id, 'monthly', 'active', now(), _expires, 'admin_grant', auth.uid());
  return _expires;
end;
$$;
grant execute on function public.admin_grant_premium(uuid, integer, text) to authenticated;
