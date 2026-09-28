begin;

create extension if not exists pgtap with schema extensions;
select plan(33);

select has_table('private', 'club_interest', 'interest addresses have a private table');
select hasnt_table('public', 'club_interest', 'interest addresses have no public table');
select has_function('public', 'join_interest_list', array['text', 'text', 'text', 'boolean'], 'anonymous visitors have a submission function requiring consent');
select is(to_regprocedure('public.join_interest_list(text,text)')::text, null::text, 'the old submission function cannot bypass consent');
select has_column('private', 'club_interest', 'phone_number', 'phone numbers are stored in the private table');
select has_column('private', 'club_interest', 'privacy_notice_version', 'the notice version is recorded');
select has_column('private', 'club_interest', 'consented_at', 'the consent time is recorded');
select ok(not has_table_privilege('anon', 'private.club_interest', 'SELECT'), 'anonymous visitors cannot read addresses');
select ok(not has_table_privilege('anon', 'private.club_interest', 'INSERT'), 'anonymous visitors cannot write directly');
select ok(has_function_privilege('anon', 'public.join_interest_list(text,text,text,boolean)', 'EXECUTE'), 'anonymous visitors may submit an address with consent');

-- Model an entry collected before consent evidence was introduced.
insert into private.club_interest (email) values ('legacy@example.com');

set local role anon;
select public.join_interest_list('  Ada@Example.com  ', null, '2026-09-28', true);
select public.join_interest_list('ada@example.com', null, '2026-09-28', true);
select public.join_interest_list('phone@example.com', '  +442079460958  ', '2026-09-28', true);
select public.join_interest_list('blank@example.com', '   ', '2026-09-28', true);
select public.join_interest_list('ada@example.com', '+12133734253', '2026-09-28', true);
select public.join_interest_list('phone@example.com', '+12133734253', '2026-09-28', true);
select public.join_interest_list('phone@example.com', null, '2026-09-28', true);
select public.join_interest_list('legacy@example.com', null, '2026-09-28', true);
select throws_ok($$select public.join_interest_list('not-an-email', null, '2026-09-28', true)$$, '22023', 'Invalid email address', 'invalid email is rejected');
select throws_ok($$select public.join_interest_list('invalid@example.com', '020 7946 0958', '2026-09-28', true)$$, '22023', 'Invalid phone number', 'phone must include the international calling code');
select throws_ok($$select public.join_interest_list('invalid@example.com', '+0123456789', '2026-09-28', true)$$, '22023', 'Invalid phone number', 'calling code cannot start with zero');
select throws_ok($$select public.join_interest_list('invalid@example.com', '+4420794609581234', '2026-09-28', true)$$, '22023', 'Invalid phone number', 'phone cannot exceed fifteen digits');
select throws_ok($$select public.join_interest_list(null, '+442079460958', '2026-09-28', true)$$, '22023', 'Invalid email address', 'a phone number cannot replace the required email');
select throws_ok($$select public.join_interest_list('invalid@example.com', null, '2026-09-28', false)$$, '22023', 'Consent is required', 'unchecked consent is rejected');
select throws_ok($$select public.join_interest_list('invalid@example.com', null, '2026-09-28', null)$$, '22023', 'Consent is required', 'missing consent is rejected');
select throws_ok($$select public.join_interest_list('invalid@example.com', null, '2026-09-27', true)$$, '22023', 'Invalid privacy notice version', 'an outdated notice is rejected');
select throws_ok($$select public.join_interest_list('invalid@example.com', null, null, true)$$, '22023', 'Invalid privacy notice version', 'a missing notice version is rejected');
select throws_ok($$select * from private.club_interest$$, '42501', 'permission denied for schema private', 'anonymous visitor cannot read the list');

reset role;
select is((select count(*)::integer from private.club_interest where email = 'ada@example.com'), 1, 'address is normalized and duplicates are idempotent');
select is((select phone_number from private.club_interest where email = 'ada@example.com'), null::text, 'phone is optional and duplicate submissions cannot add one');
select is((select phone_number from private.club_interest where email = 'phone@example.com'), '+442079460958', 'phone is normalized and duplicate submissions cannot replace or clear it');
select is((select phone_number from private.club_interest where email = 'blank@example.com'), null::text, 'blank phone is stored as null');
select is((select privacy_notice_version from private.club_interest where email = 'ada@example.com'), '2026-09-28', 'the submitted notice version is stored');
select is((select consented_at from private.club_interest where email = 'ada@example.com'), current_timestamp, 'consent uses the server timestamp');
select is((select consented_at from private.club_interest where email = 'legacy@example.com'), null::timestamptz, 'duplicates do not manufacture or replace historical consent evidence');
select is((select count(*)::integer from private.club_interest where email = 'invalid@example.com'), 0, 'invalid submissions store no contact data');
select throws_ok($$insert into private.club_interest (email, phone_number) values ('constraint@example.com', '123')$$, '23514', null, 'table constraint rejects malformed phone numbers');
select throws_ok($$insert into private.club_interest (email, privacy_notice_version) values ('constraint@example.com', '2026-09-28')$$, '23514', null, 'notice version and consent time must be paired');
select ok(not has_table_privilege('authenticated', 'private.club_interest', 'SELECT'), 'signed-in visitors cannot read contact details either');
select is((select count(*)::integer from auth.users where email = 'ada@example.com'), 0, 'joining interest list creates no Auth user');
select is((select count(*)::integer from public.member_profiles where email = 'ada@example.com'), 0, 'joining interest list creates no member profile');

select * from finish();
rollback;
