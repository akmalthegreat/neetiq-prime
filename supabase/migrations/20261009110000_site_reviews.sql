-- Public student reviews shown on the landing page.
-- One review per student (editable). Writes go through server functions (service role);
-- the public can read only published reviews.
create table if not exists public.site_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 600),
  display_name text not null check (char_length(display_name) between 1 and 40),
  target_year int,
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists site_reviews_status_created_idx on public.site_reviews (status, created_at desc);
alter table public.site_reviews enable row level security;
drop policy if exists "Public can read published reviews" on public.site_reviews;
create policy "Public can read published reviews" on public.site_reviews
  for select using (status = 'published');
drop policy if exists "Users read own review" on public.site_reviews;
create policy "Users read own review" on public.site_reviews
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Admins manage reviews" on public.site_reviews;
create policy "Admins manage reviews" on public.site_reviews
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
