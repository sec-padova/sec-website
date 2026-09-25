begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

select has_table('private', 'club_interest', 'interest addresses have a private table');
select hasnt_table('public', 'club_interest', 'interest addresses have no public table');
select has_function('public', 'join_interest_list', array['text'], 'anonymous visitors have a limited submission function');
select ok(not has_table_privilege('anon', 'private.club_interest', 'SELECT'), 'anonymous visitors cannot read addresses');
select ok(not has_table_privilege('anon', 'private.club_interest', 'INSERT'), 'anonymous visitors cannot write directly');
select ok(has_function_privilege('anon', 'public.join_interest_list(text)', 'EXECUTE'), 'anonymous visitors may submit an address');

set local role anon;
select public.join_interest_list('  Ada@Example.com  ');
select public.join_interest_list('ada@example.com');
select throws_ok($$select public.join_interest_list('not-an-email')$$, '22023', 'Invalid email address', 'invalid email is rejected');
select throws_ok($$select * from private.club_interest$$, '42501', 'permission denied for schema private', 'anonymous visitor cannot read the list');

reset role;
select is((select count(*)::integer from private.club_interest where email = 'ada@example.com'), 1, 'address is normalized and duplicates are idempotent');
select is((select count(*)::integer from auth.users where email = 'ada@example.com'), 0, 'joining interest list creates no Auth user');
select is((select count(*)::integer from public.member_profiles where email = 'ada@example.com'), 0, 'joining interest list creates no member profile');

select * from finish();
rollback;
