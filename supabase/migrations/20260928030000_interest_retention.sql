create extension if not exists pg_cron with schema pg_catalog;

create function private.remove_expired_interest()
returns integer
language sql
security definer
set search_path = ''
as $$
  with removed as (
    delete from private.club_interest
    -- Remove entries due to expire before the next hourly run, so routine
    -- cleanup happens before the 12-month limit rather than after it.
    where requested_at + interval '12 months' <= now() + interval '1 hour'
    returning email
  )
  select count(*)::integer from removed;
$$;

revoke all on function private.remove_expired_interest() from public, anon, authenticated;

select cron.schedule(
  'club-interest-retention',
  '0 * * * *',
  'select private.remove_expired_interest();'
);
