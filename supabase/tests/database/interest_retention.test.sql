begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

select has_function('private', 'remove_expired_interest', array[]::text[], 'retention cleanup is internal');
select ok(not has_function_privilege('anon', 'private.remove_expired_interest()', 'EXECUTE'), 'visitors cannot trigger cleanup');
select ok(not has_function_privilege('authenticated', 'private.remove_expired_interest()', 'EXECUTE'), 'members cannot trigger cleanup');
select is((select schedule from cron.job where jobname = 'club-interest-retention'), '0 * * * *', 'cleanup runs hourly');
select is((select command from cron.job where jobname = 'club-interest-retention'), 'select private.remove_expired_interest();', 'the job runs only interest-list cleanup');

insert into private.club_interest (email, requested_at) values
  ('retention-expired@example.com', now() - interval '13 months'),
  ('retention-soon@example.com', now() - interval '12 months' + interval '30 minutes'),
  ('retention-current@example.com', now() - interval '11 months');

select cmp_ok(private.remove_expired_interest(), '>=', 2, 'expired and imminently expiring entries are removed');
select is((select count(*)::integer from private.club_interest where email in ('retention-expired@example.com', 'retention-soon@example.com')), 0, 'old test records are gone');
select is((select count(*)::integer from private.club_interest where email = 'retention-current@example.com'), 1, 'current records are retained');

select * from finish();
rollback;
