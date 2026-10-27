begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Isolate the last-admin checks from local preview accounts. Rollback restores them.
delete from private.workspace_admins;

insert into private.workspace_invitations(email) values
  ('workspace-admin@example.com'), ('workspace-marco@example.com'), ('workspace-enrico@example.com'),
  ('workspace-event@example.com'), ('workspace-supervisor@example.com'), ('workspace-pending@example.com');
insert into auth.users(id, email, raw_user_meta_data) values
  ('71000000-0000-0000-0000-000000000001', 'workspace-admin@example.com', '{}'),
  ('71000000-0000-0000-0000-000000000002', 'workspace-marco@example.com', '{}'),
  ('71000000-0000-0000-0000-000000000003', 'workspace-enrico@example.com', '{}'),
  ('71000000-0000-0000-0000-000000000004', 'workspace-event@example.com', '{}'),
  ('71000000-0000-0000-0000-000000000005', 'workspace-supervisor@example.com', '{}'),
  ('71000000-0000-0000-0000-000000000006', 'workspace-outsider@example.com', '{"first_name":"Outside","last_name":"Member","affiliation":"external","is_admin":true}'),
  ('71000000-0000-0000-0000-000000000007', 'workspace-pending@example.com', '{"is_admin":true}');

select is((select count(*)::integer from public.member_profiles where id::text like '71000000%'), 1, 'workspace accounts need no affiliation and create no public member profiles');
select is((select count(*)::integer from public.organizers where id::text like '71000000%'), 6, 'only trusted invitations grant organizer access');
select is((select count(*)::integer from private.workspace_admins), 0, 'user metadata cannot grant admin permission');
select is((select user_id from private.workspace_invitations where email = 'workspace-pending@example.com'), '71000000-0000-0000-0000-000000000007'::uuid, 'trusted invitations link their auth account');

insert into private.organizer_profiles values
  ('71000000-0000-0000-0000-000000000001', 'Admin', 'Example'),
  ('71000000-0000-0000-0000-000000000002', 'Marco', 'Example'),
  ('71000000-0000-0000-0000-000000000003', 'Enrico', 'Example'),
  ('71000000-0000-0000-0000-000000000004', 'Event', 'Example'),
  ('71000000-0000-0000-0000-000000000005', 'Supervisor', 'Example');
insert into private.workspace_admins values ('71000000-0000-0000-0000-000000000001');
insert into private.working_groups(id, name, mission) values
  ('81000000-0000-0000-0000-000000000001', 'Test Spaces', 'Find spaces'),
  ('81000000-0000-0000-0000-000000000002', 'Test Events', 'Find speakers');

set local role anon;
select throws_ok('select public.organizer_workspace()', '42501', null, 'anonymous visitors cannot call workspace RPCs');
select throws_ok('select public.organizer_group_choices()', '42501', null, 'anonymous visitors cannot retrieve onboarding groups');
select throws_ok('select * from private.workspace_admins', '42501', null, 'admin assignments cannot be read anonymously');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000006', true);
select is(public.organizer_context()->>'authorized', 'false', 'authenticated non-organizer is denied');
select throws_ok('select public.organizer_workspace()', '42501', 'Organizer access required', 'non-organizer cannot read workspace');
select throws_ok('select public.organizer_group_choices()', '42501', 'Organizer access required', 'non-organizer cannot read group choices');
select throws_ok($$select public.complete_organizer_onboarding('Outside','Member','{}')$$, '42501', 'Organizer access required', 'onboarding cannot self-grant organizer permission');
select throws_ok('select * from private.member_work', '42501', null, 'direct workspace table reads are forbidden');

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000007', true);
select is(public.organizer_context()->>'is_admin', 'false', 'pending organizer cannot forge admin permission');
select throws_ok('select public.organizer_workspace()', '42501', 'Organizer access required', 'onboarding required before reading workspace');
select lives_ok('select public.organizer_group_choices()', 'invitee can load only onboarding group choices');
select throws_ok($$select public.complete_organizer_onboarding('Pending','Member',array['81000000-0000-0000-0000-000000000099'::uuid])$$, '22023', 'Group unavailable', 'invalid onboarding group rolls back profile creation');
select is(public.organizer_context()->'profile', 'null'::jsonb, 'failed onboarding leaves no partial profile');
select lives_ok($$select public.complete_organizer_onboarding(' Pending ',' Member ','{}')$$, 'minimal name-only onboarding succeeds with no groups');
select is(public.organizer_context()->'profile'->>'first_name', 'Pending', 'onboarding trims names');
select lives_ok('select public.organizer_workspace()', 'supervisor can read workspace after onboarding');

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
select lives_ok($$select public.set_organizer_membership('81000000-0000-0000-0000-000000000001',true)$$, 'organizer self-selects a group');
select lives_ok($$select public.set_organizer_membership('81000000-0000-0000-0000-000000000002',true)$$, 'organizer can join multiple groups');
select lives_ok($$select public.set_organizer_membership('81000000-0000-0000-0000-000000000002',false)$$, 'organizer can leave a group');
select throws_ok($$select public.set_organizer_membership('81000000-0000-0000-0000-000000000001',true,'71000000-0000-0000-0000-000000000003')$$, '42501', 'Admin access required', 'ordinary members cannot assign another member');
select throws_ok('select public.admin_workspace_access()', '42501', 'Admin access required', 'admin roster remains private');
select throws_ok($$select public.admin_prepare_organizer_invitation('new@example.com')$$, '42501', 'Admin access required', 'ordinary member cannot invite');
select throws_ok($$select public.admin_save_group('Fake','Fake')$$, '42501', 'Admin access required', 'ordinary member cannot create groups');
select throws_ok($$insert into private.workspace_admins values ('71000000-0000-0000-0000-000000000002')$$, '42501', null, 'ordinary member cannot self-promote');
select ok(not (public.organizer_workspace()::text like '%is_admin%'), 'workspace projection contains no admin indicators');
select ok(not (public.organizer_workspace()::text like '%@example.com%'), 'workspace roster contains no account emails');

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000003', true);
select lives_ok($$select public.set_organizer_membership('81000000-0000-0000-0000-000000000001',true)$$, 'second member joins Spaces');
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
select lives_ok($$select public.save_member_work('81000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000003','Calling venues','Visit two locations',1)$$, 'members can edit a peer in their group');
select throws_ok($$select public.save_member_work('81000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000003','Overwrite','',1)$$, '40001', 'Work changed; refresh before saving', 'stale revision cannot overwrite a summary');
select lives_ok($$select public.publish_group_update('81000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000003','Two venues contacted')$$, 'group member can publish an update about another member');
select throws_ok($$select public.publish_group_update('81000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000005','Wrong member')$$, '22023', 'Group member required', 'update subject must belong to that group');
select throws_ok($$select public.save_member_work('81000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000004','Cross-group','',1)$$, '42501', 'Group membership required', 'cannot write another group');

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000005', true);
select lives_ok('select public.organizer_workspace()', 'supervisor reads all groups');
select throws_ok($$select public.publish_group_update('81000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','Supervisor edit')$$, '42501', 'Group membership required', 'supervisor has no editing bypass');

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
select is(public.organizer_context()->>'is_admin', 'true', 'admin sees their own admin permission');
select lives_ok('select public.admin_workspace_access()', 'admin can read accounts and admin assignments');
select throws_ok($$select public.save_member_work('81000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000003','Admin bypass','',2)$$, '42501', 'Group membership required', 'admin cannot bypass content membership rules');
select lives_ok($$select public.set_organizer_membership('81000000-0000-0000-0000-000000000001',true)$$, 'admin can also join a working group');
select lives_ok($$select public.save_member_work('81000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000003','Visiting venues','Confirm availability',2)$$, 'admin group member has normal content editing permission');
select lives_ok($$select public.set_organizer_membership('81000000-0000-0000-0000-000000000002',true,'71000000-0000-0000-0000-000000000004')$$, 'admin assigns another organizer');
select lives_ok($$select public.admin_save_group('Test Events','Find speakers','81000000-0000-0000-0000-000000000002',1,true)$$, 'admin archives group');
select throws_ok($$select public.admin_save_group('Overwrite','Wrong','81000000-0000-0000-0000-000000000002',1,false)$$, '40001', 'Group changed; refresh before saving', 'group settings reject stale revisions');

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000004', true);
select lives_ok('select public.organizer_workspace()', 'archived groups remain readable');
select throws_ok($$select public.save_member_work('81000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000004','Archived','',1)$$, '42501', 'Group unavailable', 'archived summaries cannot be edited');
select throws_ok($$select public.publish_group_update('81000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000004','Archived update')$$, '42501', 'Group unavailable', 'archived updates cannot be published');
select throws_ok($$select public.set_organizer_membership('81000000-0000-0000-0000-000000000002',true)$$, '42501', 'Group unavailable', 'archived group cannot be joined');

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000003', true);
select lives_ok($$select public.set_organizer_membership('81000000-0000-0000-0000-000000000001',false)$$, 'member leaves group');
select throws_ok($$select public.publish_group_update('81000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','After leaving')$$, '42501', 'Group membership required', 'leaving immediately removes editing permission');
reset role;
select is((select count(*)::integer from private.member_work where organizer_id = '71000000-0000-0000-0000-000000000003'), 0, 'leaving removes current summaries');
select is((select subject_name from private.working_group_updates where group_id = '81000000-0000-0000-0000-000000000001'), 'Enrico Example', 'leaving preserves historical subject names');
select is((select author_name from private.working_group_updates where group_id = '81000000-0000-0000-0000-000000000001'), 'Marco Example', 'history records actual author');

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
select lives_ok($$select public.admin_save_group('Test Events','Find speakers','81000000-0000-0000-0000-000000000002',2,false)$$, 'admin reopens group');
select lives_ok($$select public.admin_save_group('New group','New mission')$$, 'admin creates a group');
select throws_ok($$select public.admin_revoke_organizer('71000000-0000-0000-0000-000000000001')$$, '22023', 'Cannot revoke the last admin', 'last admin cannot be revoked');
select lives_ok($$select public.admin_prepare_organizer_invitation(' RETRY@example.com ')$$, 'admin prepares normalized invitation');
select lives_ok($$select public.admin_prepare_organizer_invitation('retry@example.com')$$, 'duplicate preparation is idempotent');
select lives_ok($$select public.admin_prepare_organizer_invitation('workspace-outsider@example.com')$$, 'admin can authorize existing Auth account');
select lives_ok($$select public.admin_revoke_organizer(null,'retry@example.com')$$, 'failed or pending invitation can be revoked');
select lives_ok($$select public.admin_revoke_organizer('71000000-0000-0000-0000-000000000002')$$, 'admin revokes organizer');
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
select is(public.organizer_context()->>'authorized', 'false', 'revoked account immediately loses organizer access');
select throws_ok('select public.organizer_workspace()', '42501', 'Organizer access required', 'old session cannot read after revocation');
select throws_ok($$select public.save_member_work('81000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','Revoked','',1)$$, '42501', 'Organizer access required', 'old session cannot write after revocation');
reset role;
select is((select count(*)::integer from private.working_group_members where organizer_id = '71000000-0000-0000-0000-000000000002'), 0, 'revocation removes memberships');
select is((select count(*)::integer from private.organizer_profiles where id = '71000000-0000-0000-0000-000000000002'), 0, 'revocation removes workspace profile');
select is((select active from private.workspace_invitations where email = 'workspace-marco@example.com'), false, 'revocation deactivates trusted invitation');
select is((select count(*)::integer from private.workspace_invitations where email = 'retry@example.com'), 1, 'retries keep a single invitation record');
select is((select active from private.workspace_invitations where email = 'retry@example.com'), false, 'pending invitation is disabled after revocation');
select is((select count(*)::integer from private.working_group_updates where group_id = '81000000-0000-0000-0000-000000000001'), 1, 'revocation preserves append-only update history');
select * from finish();
rollback;
