begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

select has_table('private', 'club_interest', 'interest addresses have a private table');
select hasnt_table('public', 'club_interest', 'interest addresses have no public table');
select has_function('public', 'join_interest_list', array['text', 'text'], 'anonymous visitors have a limited submission function');
select has_column('private', 'club_interest', 'phone_number', 'phone numbers are stored in the private table');
select ok(not has_table_privilege('anon', 'private.club_interest', 'SELECT'), 'anonymous visitors cannot read addresses');
select ok(not has_table_privilege('anon', 'private.club_interest', 'INSERT'), 'anonymous visitors cannot write directly');
select ok(has_function_privilege('anon', 'public.join_interest_list(text, text)', 'EXECUTE'), 'anonymous visitors may submit an address');

set local role anon;
select public.join_interest_list('  Ada@Example.com  ');
select public.join_interest_list('ada@example.com');
select public.join_interest_list('phone@example.com', '  +442079460958  ');
select public.join_interest_list('blank@example.com', '   ');
select public.join_interest_list('ada@example.com', '+12133734253');
select public.join_interest_list('phone@example.com', '+12133734253');
select public.join_interest_list('phone@example.com');
select throws_ok($$select public.join_interest_list('not-an-email')$$, '22023', 'Invalid email address', 'invalid email is rejected');
select throws_ok($$select public.join_interest_list('invalid@example.com', '020 7946 0958')$$, '22023', 'Invalid phone number', 'phone must include the international calling code');
select throws_ok($$select public.join_interest_list('invalid@example.com', '+0123456789')$$, '22023', 'Invalid phone number', 'calling code cannot start with zero');
select throws_ok($$select public.join_interest_list('invalid@example.com', '+4420794609581234')$$, '22023', 'Invalid phone number', 'phone cannot exceed fifteen digits');
select throws_ok($$select public.join_interest_list(null, '+442079460958')$$, '22023', 'Invalid email address', 'a phone number cannot replace the required email');
select throws_ok($$select * from private.club_interest$$, '42501', 'permission denied for schema private', 'anonymous visitor cannot read the list');

reset role;
select is((select count(*)::integer from private.club_interest where email = 'ada@example.com'), 1, 'address is normalized and duplicates are idempotent');
select is((select phone_number from private.club_interest where email = 'ada@example.com'), null::text, 'phone is optional and duplicate submissions cannot add one');
select is((select phone_number from private.club_interest where email = 'phone@example.com'), '+442079460958', 'phone is normalized and duplicate submissions cannot replace or clear it');
select is((select phone_number from private.club_interest where email = 'blank@example.com'), null::text, 'blank phone is stored as null');
select is((select count(*)::integer from private.club_interest where email = 'invalid@example.com'), 0, 'invalid phone submissions store no contact data');
select throws_ok($$insert into private.club_interest (email, phone_number) values ('constraint@example.com', '123')$$, '23514', null, 'table constraint rejects malformed phone numbers');
select ok(not has_table_privilege('authenticated', 'private.club_interest', 'SELECT'), 'signed-in visitors cannot read contact details either');
select is((select count(*)::integer from auth.users where email = 'ada@example.com'), 0, 'joining interest list creates no Auth user');
select is((select count(*)::integer from public.member_profiles where email = 'ada@example.com'), 0, 'joining interest list creates no member profile');

select * from finish();
rollback;
