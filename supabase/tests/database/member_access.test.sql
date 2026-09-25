begin;

create extension if not exists pgtap with schema extensions;
select plan(23);

select has_table('public', 'member_profiles', 'member profiles exist');
select has_table('public', 'organizers', 'organizer roles exist');
select has_table('public', 'member_directory', 'public directory exists');
select has_table('public', 'unipd_departments', 'controlled UniPd department list exists');
select is((select count(*)::integer from public.unipd_departments), 32, 'all 32 departments are available');
select is((select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name = 'member_directory' and column_name = 'email'), 0, 'public directory has no email column');
select ok(not has_table_privilege('authenticated', 'public.organizers', 'INSERT'), 'members cannot grant organizer access');
select ok(not has_column_privilege('authenticated', 'public.member_profiles', 'status', 'UPDATE'), 'members cannot change approval status');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'ada@example.test', '{"first_name":"Ada","last_name":"Example","affiliation":"student","department":"Department of Information Engineering - DEI"}'::jsonb),
  ('10000000-0000-0000-0000-000000000002', 'zoe@example.test', '{"first_name":"Zoe","last_name":"Example","affiliation":"external"}'::jsonb),
  ('10000000-0000-0000-0000-000000000003', 'leo@example.test', '{"first_name":"Leo","last_name":"Example","affiliation":"student"}'::jsonb);

select is((select department from public.member_profiles where id = '10000000-0000-0000-0000-000000000002'), null::text, 'external member may omit department');
select is((select department from public.member_profiles where id = '10000000-0000-0000-0000-000000000003'), null::text, 'student may also omit department');
select throws_ok($$update public.member_profiles set department = 'Made-up department' where id = '10000000-0000-0000-0000-000000000001'$$, '23503');

select is((select status from public.member_profiles where id = '10000000-0000-0000-0000-000000000001'), 'pending', 'new members await approval');
select is((select public_directory_opt_in from public.member_profiles where id = '10000000-0000-0000-0000-000000000001'), false, 'new members are private by default');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.member_profiles), 1, 'member sees only their own profile');
update public.member_profiles set first_name = 'Ada Updated' where id = '10000000-0000-0000-0000-000000000001';
select is((select first_name from public.member_profiles where id = '10000000-0000-0000-0000-000000000001'), 'Ada Updated', 'member can edit their own profile');
update public.member_profiles set first_name = 'Hacked' where id = '10000000-0000-0000-0000-000000000002';
select throws_ok(
  $$update public.member_profiles set status = 'active' where id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', 'permission denied for table member_profiles', 'member cannot approve themself'
);
select throws_ok(
  $$insert into public.organizers (id) values ('10000000-0000-0000-0000-000000000001')$$,
  '42501', 'permission denied for table organizers', 'member cannot grant organizer role'
);

reset role;
select is((select first_name from public.member_profiles where id = '10000000-0000-0000-0000-000000000002'), 'Zoe', 'member cannot edit another profile');
update public.member_profiles
set status = 'active', public_directory_opt_in = true
where id = '10000000-0000-0000-0000-000000000001';

set local role anon;
select throws_ok('select * from public.member_profiles', '42501', 'permission denied for table member_profiles', 'anonymous visitors cannot read private profiles');
select is((select count(*)::integer from public.unipd_departments), 32, 'registration can load department choices before sign-in');
select is((select count(*)::integer from public.member_directory), 1, 'only approved, opted-in members appear publicly');

reset role;
update public.member_profiles set public_directory_opt_in = false where id = '10000000-0000-0000-0000-000000000001';
set local role anon;
select is((select count(*)::integer from public.member_directory), 0, 'opt-out removes a member from the public directory');

reset role;
insert into public.organizers (id) values ('10000000-0000-0000-0000-000000000001');
set local role authenticated;
select is((select count(*)::integer from public.member_profiles), 3, 'organizer can review all profiles');

reset role;
select * from finish();
rollback;
