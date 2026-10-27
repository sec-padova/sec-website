-- Workspace data is private. The browser receives only checked RPC projections.
create table private.workspace_admins (
  id uuid primary key references public.organizers(id) on delete cascade
);

create table private.organizer_profiles (
  id uuid primary key references public.organizers(id) on delete cascade,
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text not null check (length(trim(last_name)) between 1 and 100)
);

create table private.workspace_invitations (
  email text primary key check (email = lower(trim(email)) and length(email) between 3 and 320),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  active boolean not null default true
);

create table private.working_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  mission text not null check (length(trim(mission)) between 1 and 2000),
  archived_at timestamptz,
  revision integer not null default 1,
  created_at timestamptz not null default now()
);

create table private.working_group_members (
  group_id uuid not null references private.working_groups(id),
  organizer_id uuid not null references private.organizer_profiles(id) on delete cascade,
  primary key (group_id, organizer_id)
);

create table private.member_work (
  group_id uuid not null,
  organizer_id uuid not null,
  working_on text not null default '' check (length(working_on) <= 4000),
  next_steps text not null default '' check (length(next_steps) <= 4000),
  revision integer not null default 1,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  primary key (group_id, organizer_id),
  foreign key (group_id, organizer_id) references private.working_group_members(group_id, organizer_id) on delete cascade
);

create table private.working_group_updates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references private.working_groups(id),
  subject_id uuid references auth.users(id) on delete set null,
  subject_name text not null,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

revoke all on private.workspace_admins, private.organizer_profiles, private.workspace_invitations,
  private.working_groups, private.working_group_members, private.member_work, private.working_group_updates
  from public, anon, authenticated;

alter table private.workspace_admins enable row level security;
alter table private.organizer_profiles enable row level security;
alter table private.workspace_invitations enable row level security;
alter table private.working_groups enable row level security;
alter table private.working_group_members enable row level security;
alter table private.member_work enable row level security;
alter table private.working_group_updates enable row level security;

insert into private.working_groups (name, mission) values
  ('Spaces', 'Find locations for our main events and places for the team to meet and work.'),
  ('Events', 'Find speakers and shape what we will cover at the next event.'),
  ('Marketing', 'Promote the club and its events, define our brand identity and calls to action.'),
  ('Management', 'Define the club’s organization and understand how to become an official association.');

create function private.require_workspace(p_admin boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.organizers o join private.organizer_profiles p on p.id = o.id where o.id = auth.uid()) then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;
  if p_admin and not exists (select 1 from private.workspace_admins where id = auth.uid()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
end;
$$;

-- Serializes edits, joining/leaving, and archiving within the same group.
create function private.require_group_edit(p_group_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_workspace();
  perform 1 from private.working_groups where id = p_group_id and archived_at is null for update;
  if not found then raise exception 'Group unavailable' using errcode = '42501'; end if;
  if not exists (select 1 from private.working_group_members where group_id = p_group_id and organizer_id = auth.uid()) then
    raise exception 'Group membership required' using errcode = '42501';
  end if;
end;
$$;

create function public.organizer_context()
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'authorized', exists(select 1 from public.organizers where id = auth.uid()),
    'profile', (select jsonb_build_object('id', id, 'first_name', first_name, 'last_name', last_name) from private.organizer_profiles where id = auth.uid()),
    'is_admin', exists(select 1 from private.workspace_admins a join public.organizers o on o.id = a.id where a.id = auth.uid())
  );
$$;

create function public.complete_organizer_onboarding(p_first_name text, p_last_name text, p_group_ids uuid[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare group_id uuid;
begin
  perform 1 from public.organizers where id = auth.uid() for update;
  if not found then raise exception 'Organizer access required' using errcode = '42501'; end if;
  if p_first_name is null or p_last_name is null then raise exception 'Name required' using errcode = '22023'; end if;
  insert into private.organizer_profiles(id, first_name, last_name)
    values (auth.uid(), trim(p_first_name), trim(p_last_name));
  for group_id in select distinct unnest(coalesce(p_group_ids, '{}')) order by 1 loop
    perform 1 from private.working_groups where id = group_id and archived_at is null for update;
    if not found then raise exception 'Group unavailable' using errcode = '22023'; end if;
    insert into private.working_group_members values (group_id, auth.uid());
    insert into private.member_work(group_id, organizer_id) values (group_id, auth.uid());
  end loop;
end;
$$;

-- Names and missions are available during onboarding, exclusively to invitees.
create function public.organizer_group_choices()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.organizers where id = auth.uid()) then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'mission', mission) order by created_at, name)
    from private.working_groups where archived_at is null), '[]'::jsonb);
end;
$$;

create function public.organizer_workspace()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_workspace();
  return jsonb_build_object(
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'first_name', p.first_name, 'last_name', p.last_name) order by p.first_name, p.last_name)
      from private.organizer_profiles p join public.organizers o on o.id = p.id), '[]'::jsonb),
    'groups', coalesce((select jsonb_agg(jsonb_build_object(
      'id', g.id, 'name', g.name, 'mission', g.mission, 'archived_at', g.archived_at, 'revision', g.revision,
      'members', coalesce((select jsonb_agg(jsonb_build_object('organizer_id', w.organizer_id, 'working_on', w.working_on,
        'next_steps', w.next_steps, 'revision', w.revision, 'updated_at', w.updated_at, 'updated_by', w.updated_by) order by p.first_name, p.last_name)
        from private.member_work w join private.organizer_profiles p on p.id = w.organizer_id where w.group_id = g.id), '[]'::jsonb),
      'updates', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'subject_name', u.subject_name, 'author_name', u.author_name,
        'body', u.body, 'created_at', u.created_at) order by u.created_at desc, u.id)
        from private.working_group_updates u where u.group_id = g.id), '[]'::jsonb)
      ) order by g.created_at, g.name) from private.working_groups g), '[]'::jsonb)
  );
end;
$$;

create function public.set_organizer_membership(p_group_id uuid, p_join boolean, p_organizer_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare target uuid := coalesce(p_organizer_id, auth.uid());
begin
  perform private.require_workspace(target <> auth.uid());
  perform 1 from public.organizers where id = target for update;
  if not found then raise exception 'Organizer unavailable' using errcode = '22023'; end if;
  perform 1 from private.working_groups where id = p_group_id and archived_at is null for update;
  if not found then raise exception 'Group unavailable' using errcode = '42501'; end if;
  if p_join is null then raise exception 'Membership choice required' using errcode = '22023'; end if;
  if p_join then
    insert into private.working_group_members values (p_group_id, target) on conflict do nothing;
    insert into private.member_work(group_id, organizer_id) values (p_group_id, target) on conflict do nothing;
  else
    delete from private.working_group_members where group_id = p_group_id and organizer_id = target;
  end if;
end;
$$;

create function public.save_member_work(p_group_id uuid, p_organizer_id uuid, p_working_on text, p_next_steps text, p_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_group_edit(p_group_id);
  update private.member_work set working_on = p_working_on, next_steps = p_next_steps,
    revision = revision + 1, updated_at = now(), updated_by = auth.uid()
    where group_id = p_group_id and organizer_id = p_organizer_id and revision = p_revision;
  if not found then raise exception 'Work changed; refresh before saving' using errcode = '40001'; end if;
end;
$$;

create function public.publish_group_update(p_group_id uuid, p_subject_id uuid, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare subject_name text; author_name text;
begin
  perform private.require_group_edit(p_group_id);
  select p.first_name || ' ' || p.last_name into subject_name from private.organizer_profiles p
    join private.working_group_members m on m.organizer_id = p.id where m.group_id = p_group_id and p.id = p_subject_id;
  if subject_name is null then raise exception 'Group member required' using errcode = '22023'; end if;
  select first_name || ' ' || last_name into author_name from private.organizer_profiles where id = auth.uid();
  insert into private.working_group_updates(group_id, subject_id, subject_name, author_id, author_name, body)
    values (p_group_id, p_subject_id, subject_name, auth.uid(), author_name, trim(p_body));
end;
$$;

create function public.admin_save_group(p_name text, p_mission text, p_group_id uuid default null, p_revision integer default null, p_archived boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_workspace(true);
  if p_group_id is null then
    insert into private.working_groups(name, mission) values (trim(p_name), trim(p_mission));
  else
    update private.working_groups set name = trim(p_name), mission = trim(p_mission), revision = revision + 1,
      archived_at = case when p_archived then coalesce(archived_at, now()) else null end
      where id = p_group_id and revision = p_revision;
    if not found then raise exception 'Group changed; refresh before saving' using errcode = '40001'; end if;
  end if;
end;
$$;

create function public.admin_workspace_access()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_workspace(true);
  return jsonb_build_object(
    'admins', coalesce((select jsonb_agg(id) from private.workspace_admins), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'email', u.email) order by u.email)
      from public.organizers o join auth.users u on u.id = o.id), '[]'::jsonb),
    'invitations', coalesce((select jsonb_agg(jsonb_build_object('email', email, 'invited_at', invited_at, 'active', active, 'user_id', user_id)
      order by invited_at desc) from private.workspace_invitations), '[]'::jsonb)
  );
end;
$$;

-- Only ordinary organizer invitations are available in the application.
create function public.admin_prepare_organizer_invitation(p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare normalized text := lower(trim(p_email)); target uuid;
begin
  perform private.require_workspace(true);
  if normalized is null or length(normalized) > 320 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email' using errcode = '22023';
  end if;
  select id into target from auth.users where lower(email) = normalized;
  insert into private.workspace_invitations(email, invited_by, user_id) values (normalized, auth.uid(), target)
    on conflict(email) do update set active = true, invited_by = auth.uid(), invited_at = now(), user_id = target;
  if target is not null then
    insert into public.organizers(id, granted_by) values (target, auth.uid()) on conflict do nothing;
  end if;
  return jsonb_build_object('email', normalized, 'user_id', target);
end;
$$;

create function public.admin_revoke_organizer(p_organizer_id uuid default null, p_email text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare target uuid := p_organizer_id; target_email text;
begin
  perform private.require_workspace(true);
  lock table private.workspace_admins in exclusive mode;
  if target is null then
    select user_id into target from private.workspace_invitations where email = lower(trim(p_email));
  end if;
  if exists(select 1 from private.workspace_admins where id = target) and (select count(*) from private.workspace_admins) <= 1 then
    raise exception 'Cannot revoke the last admin' using errcode = '22023';
  end if;
  select email into target_email from auth.users where id = target;
  update private.workspace_invitations set active = false
    where user_id = target or email = lower(trim(p_email)) or email = lower(target_email);
  delete from public.organizers where id = target;
end;
$$;

-- A trusted invitation, rather than editable metadata, admits workspace users.
create or replace function private.create_member_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare inviter uuid;
begin
  select invited_by into inviter from private.workspace_invitations where email = lower(new.email) and active for update;
  if found then
    insert into public.organizers(id, granted_by) values (new.id, inviter) on conflict do nothing;
    update private.workspace_invitations set user_id = new.id where email = lower(new.email);
    return new;
  end if;
  insert into public.member_profiles(id, email, first_name, last_name, affiliation, department, school)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), new.raw_user_meta_data ->> 'affiliation',
    nullif(trim(new.raw_user_meta_data ->> 'department'), ''), nullif(trim(new.raw_user_meta_data ->> 'school'), ''));
  return new;
end;
$$;

-- Explicit grants: no function inherits PUBLIC execution privileges.
revoke all on function private.require_workspace(boolean), private.require_group_edit(uuid) from public, anon, authenticated;
revoke all on function public.organizer_context(), public.complete_organizer_onboarding(text,text,uuid[]),
  public.organizer_group_choices(), public.organizer_workspace(), public.set_organizer_membership(uuid,boolean,uuid),
  public.save_member_work(uuid,uuid,text,text,integer), public.publish_group_update(uuid,uuid,text),
  public.admin_save_group(text,text,uuid,integer,boolean), public.admin_workspace_access(),
  public.admin_prepare_organizer_invitation(text), public.admin_revoke_organizer(uuid,text) from public, anon, authenticated;
grant execute on function public.organizer_context(), public.complete_organizer_onboarding(text,text,uuid[]),
  public.organizer_group_choices(), public.organizer_workspace(), public.set_organizer_membership(uuid,boolean,uuid),
  public.save_member_work(uuid,uuid,text,text,integer), public.publish_group_update(uuid,uuid,text),
  public.admin_save_group(text,text,uuid,integer,boolean), public.admin_workspace_access(),
  public.admin_prepare_organizer_invitation(text), public.admin_revoke_organizer(uuid,text) to authenticated;
