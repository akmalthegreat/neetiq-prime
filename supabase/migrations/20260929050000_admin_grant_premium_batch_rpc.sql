-- Restore the RPC used by the batch-aware admin grant panel.
-- Keeps legacy three-argument grants working while supporting batch-scoped access.

create or replace function public.admin_grant_premium(
  _batch_id uuid,
  _days integer,
  _note text,
  _user_id uuid
)
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

  if _days < 1 or _days > 3650 then
    raise exception 'Days must be between 1 and 3650';
  end if;

  if _batch_id is not null and not exists (
    select 1 from public.batches where id = _batch_id
  ) then
    raise exception 'Batch not found';
  end if;

  _expires := now() + make_interval(days => _days);

  insert into public.subscriptions (
    user_id,
    plan,
    status,
    started_at,
    expires_at,
    source,
    source_batch_id,
    granted_by
  )
  values (
    _user_id,
    'monthly',
    'active',
    now(),
    _expires,
    'admin_grant',
    _batch_id,
    auth.uid()
  );

  -- _note is accepted for audit compatibility with the admin UI. The
  -- subscriptions table does not currently have a note column.
  return _expires;
end;
$$;

grant execute on function public.admin_grant_premium(uuid, integer, text, uuid) to authenticated;

-- Backward-compatible wrapper for older server bundles and manual SQL callers.
create or replace function public.admin_grant_premium(
  _user_id uuid,
  _days integer,
  _note text default null
)
returns timestamptz
language sql
security definer
set search_path = public
as $$
  select public.admin_grant_premium(null::uuid, _days, _note, _user_id);
$$;

grant execute on function public.admin_grant_premium(uuid, integer, text) to authenticated;
