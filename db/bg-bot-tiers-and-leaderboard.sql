-- Battlegrounds: tier-based bot win caps + daily leaderboard (incl. bots).

create table if not exists public.bg_bot_outcomes_daily (
  day date not null,
  tier text not null check (tier in ('free','low','high')),
  bot_wins int not null default 0,
  bot_losses int not null default 0,
  ties int not null default 0,
  primary key (day, tier)
);
grant select on public.bg_bot_outcomes_daily to authenticated;
grant all on public.bg_bot_outcomes_daily to service_role;
alter table public.bg_bot_outcomes_daily enable row level security;
drop policy if exists "bg_outcomes_read" on public.bg_bot_outcomes_daily;
create policy "bg_outcomes_read" on public.bg_bot_outcomes_daily for select to authenticated using (true);

create or replace function public.bg_stake_tier(_stake numeric)
returns text language sql immutable as $$
  select case
    when coalesce(_stake,0) <= 0 then 'free'
    when _stake < 10 then 'low'
    else 'high'
  end
$$;

create or replace function public.bg_tier_target_bot_win_pct(_tier text)
returns int language sql immutable as $$
  select case _tier
    when 'free' then 25
    when 'low'  then 50
    when 'high' then 66
    else 50
  end
$$;

create or replace function public.bg_decide_bot_outcome(_tier text)
returns text language plpgsql security definer set search_path = public as $$
declare
  _today date := (now() at time zone 'utc')::date;
  _w int := 0; _l int := 0; _t int := 0; _total int;
  _target int := public.bg_tier_target_bot_win_pct(_tier);
  _current_pct int;
  _r numeric := random() * 100;
begin
  select bot_wins, bot_losses, ties into _w, _l, _t
    from public.bg_bot_outcomes_daily where day = _today and tier = _tier;
  _total := coalesce(_w,0) + coalesce(_l,0) + coalesce(_t,0);
  if _total >= 8 then
    _current_pct := round( (coalesce(_w,0)::numeric * 100) / nullif(_total,0) );
    if _current_pct < (_target - 5) then
      return 'bot_win';
    end if;
  end if;
  if _tier = 'free' and _r < 5 then return 'tie'; end if;
  if _r < _target then return 'bot_win'; end if;
  return 'bot_loss';
end $$;
grant execute on function public.bg_decide_bot_outcome(text) to authenticated, service_role;

create or replace function public.bg_record_bot_outcome(_tier text, _outcome text)
returns void language plpgsql security definer set search_path = public as $$
declare
  _today date := (now() at time zone 'utc')::date;
begin
  insert into public.bg_bot_outcomes_daily (day, tier, bot_wins, bot_losses, ties)
  values (_today, _tier,
          case when _outcome='bot_win'  then 1 else 0 end,
          case when _outcome='bot_loss' then 1 else 0 end,
          case when _outcome='tie'      then 1 else 0 end)
  on conflict (day, tier) do update set
    bot_wins   = public.bg_bot_outcomes_daily.bot_wins   + excluded.bot_wins,
    bot_losses = public.bg_bot_outcomes_daily.bot_losses + excluded.bot_losses,
    ties       = public.bg_bot_outcomes_daily.ties       + excluded.ties;
end $$;
grant execute on function public.bg_record_bot_outcome(text,text) to authenticated, service_role;

create or replace function public.bg_daily_leaderboard(_limit int default 20)
returns table (
  rank int,
  display_name text,
  avatar_url text,
  is_bot boolean,
  wins int,
  battles int,
  winnings numeric
) language sql security definer set search_path = public as $$
  with since as (select (now() - interval '24 hours') as t),
  human_battles as (
    select bmp.user_id,
           sum( case when m.winner_user_id = bmp.user_id then 1 else 0 end )::int as wins,
           count(*)::int as battles,
           sum( case when m.winner_user_id = bmp.user_id then m.prize_amount else 0 end ) as winnings
      from public.battle_match_players bmp
      join public.battle_matches m on m.id = bmp.match_id
     where m.status = 'finished'
       and m.started_at >= (select t from since)
     group by bmp.user_id
  ),
  human_rows as (
    select hb.user_id::text as key,
           coalesce(nullif(p.full_name,''), 'Player') as display_name,
           p.avatar_url,
           false as is_bot,
           hb.wins, hb.battles, hb.winnings
      from human_battles hb
      left join public.profiles p on p.id = hb.user_id
  ),
  bot_battles as (
    select coalesce(nullif(m.bot_name,''),'Bot') as name,
           m.bot_avatar_url as avatar_url,
           count(*) filter (where m.is_bot_match and m.winner_user_id is null and m.status='finished')::int as wins,
           count(*)::int as battles,
           sum(m.stake) filter (where m.winner_user_id is null) as winnings
      from public.battle_matches m
     where m.is_bot_match = true
       and m.status = 'finished'
       and m.started_at >= (select t from since)
     group by 1, 2
  ),
  bot_rows as (
    select ('bot:'||name) as key, name as display_name, avatar_url, true as is_bot,
           coalesce(wins,0) as wins, battles, coalesce(winnings,0) as winnings
      from bot_battles
  ),
  unioned as (
    select * from human_rows
    union all
    select * from bot_rows
  )
  select (row_number() over (order by wins desc, winnings desc, battles desc))::int as rank,
         display_name, avatar_url, is_bot, wins, battles, coalesce(winnings,0) as winnings
    from unioned
   where wins > 0 or battles > 0
   order by rank
   limit greatest(1, least(_limit, 100));
$$;
grant execute on function public.bg_daily_leaderboard(int) to authenticated, anon, service_role;
