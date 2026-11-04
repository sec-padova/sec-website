create extension if not exists pgcrypto with schema extensions;

-- A singleton row serializes admission, rotation, revocation, and restoration.
create table private.organizer_registration_link (
  singleton boolean primary key default true check (singleton),
  token_hash text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);
insert into private.organizer_registration_link(singleton) values (true);
create table private.organizer_registration_attempts (
  bucket text primary key,
  started_at timestamptz not null,
  attempts integer not null
);
-- Auth initially inserts users before applying app_metadata. A short-lived,
-- service-only reservation lets that insert skip unrelated club onboarding.
create table private.organizer_registration_pending (
  email text primary key,
  expires_at timestamptz not null
);
alter table private.organizer_registration_pending enable row level security;
revoke all on private.organizer_registration_pending from public, anon, authenticated;

alter table private.organizer_registration_link enable row level security;
alter table private.organizer_registration_attempts enable row level security;
revoke all on private.organizer_registration_link, private.organizer_registration_attempts from public, anon, authenticated;

create function public.admin_registration_link(p_hash text default null, p_revoke boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare issued_at timestamptz;
begin
  perform private.require_workspace(true);
  perform 1 from private.organizer_registration_link for update;
  if p_revoke then
    update private.organizer_registration_link set revoked_at = clock_timestamp();
  elsif p_hash is not null then
    if p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid token hash'; end if;
    issued_at := clock_timestamp();
    update private.organizer_registration_link set token_hash = p_hash, created_by = auth.uid(),
      created_at = issued_at, expires_at = issued_at + interval '8 hours', revoked_at = null;
  end if;
  return (select jsonb_build_object('created_at', created_at, 'expires_at', expires_at, 'revoked_at', revoked_at) from private.organizer_registration_link);
end;
$$;

create function public.check_organizer_registration(p_hash text, p_email text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare item private.organizer_registration_link; key text; n integer; window_size interval;
begin
  select * into item from private.organizer_registration_link for update;
  if item.token_hash is distinct from p_hash or item.revoked_at is not null or item.expires_at is null or item.expires_at <= clock_timestamp() then
    raise exception 'Registration link unavailable' using errcode = 'PT410';
  end if;
  if p_email is not null then
    -- Expired buckets are disposable and contain hashes rather than email addresses.
    delete from private.organizer_registration_attempts where started_at < clock_timestamp() - interval '15 minutes';
    foreach key in array array['link:' || p_hash, 'email:' || encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex')] loop
      window_size := case when key like 'link:%' then interval '1 minute' else interval '15 minutes' end;
      insert into private.organizer_registration_attempts values(key, clock_timestamp(), 1)
      on conflict(bucket) do update set
        attempts = case when private.organizer_registration_attempts.started_at + window_size <= clock_timestamp() then 1 else private.organizer_registration_attempts.attempts + 1 end,
        started_at = case when private.organizer_registration_attempts.started_at + window_size <= clock_timestamp() then clock_timestamp() else private.organizer_registration_attempts.started_at end
      returning attempts into n;
      if n > (case when key like 'link:%' then 60 else 10 end) then
        raise exception 'Please retry later' using errcode = 'PT429';
      end if;
    end loop;
    if exists(select 1 from private.workspace_invitations where email = lower(trim(p_email)) and not active) then
      raise exception 'Ask the admin to restore access' using errcode = '42501';
    end if;
    delete from private.organizer_registration_pending where expires_at <= clock_timestamp();
    insert into private.organizer_registration_pending values(lower(trim(p_email)), least(item.expires_at, clock_timestamp() + interval '15 minutes'))
      on conflict(email) do update set expires_at = excluded.expires_at;
  end if;
end;
$$;

create function public.redeem_organizer_registration(p_hash text, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare address text; inviter uuid;
begin
  perform public.check_organizer_registration(p_hash);
  select lower(email) into address from auth.users where id = p_user_id;
  if address is null then raise exception 'Account unavailable' using errcode = '42501'; end if;
  if exists(select 1 from private.workspace_invitations where (email = address or user_id = p_user_id) and not active) then
    raise exception 'Ask the admin to restore access' using errcode = '42501';
  end if;
  select created_by into inviter from private.organizer_registration_link;
  insert into private.workspace_invitations(email, invited_by, user_id) values(address, inviter, p_user_id)
    on conflict(email) do update set user_id = excluded.user_id;
  insert into public.organizers(id, granted_by) values(p_user_id, inviter) on conflict do nothing;
  delete from private.organizer_registration_pending where email = address;
end;
$$;

-- Shared registration provisions credentials before granting any workspace access.
-- The service-only reservation skips the unrelated member profile trigger.
create or replace function private.create_member_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare inviter uuid;
begin
  if exists(select 1 from private.organizer_registration_pending where email = lower(new.email) and expires_at > clock_timestamp()) then return new; end if;
  select invited_by into inviter from private.workspace_invitations where email = lower(new.email) and active for update;
  if found then
    insert into public.organizers(id, granted_by) values(new.id, inviter) on conflict do nothing;
    update private.workspace_invitations set user_id = new.id where email = lower(new.email);
    return new;
  end if;
  insert into public.member_profiles(id, email, first_name, last_name, affiliation, department, school)
  values(new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), new.raw_user_meta_data ->> 'affiliation',
    nullif(trim(new.raw_user_meta_data ->> 'department'), ''), nullif(trim(new.raw_user_meta_data ->> 'school'), ''));
  return new;
end;
$$;

-- Serialize the existing revoke operation against shared-link admission.
alter function public.admin_revoke_organizer(uuid,text) rename to workspace_revoke_organizer_internal;
revoke all on function public.workspace_revoke_organizer_internal(uuid,text) from public, anon, authenticated;
create function public.admin_revoke_organizer(p_organizer_id uuid default null, p_email text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_workspace(true);
  perform 1 from private.organizer_registration_link for update;
  perform public.workspace_revoke_organizer_internal(p_organizer_id, p_email);
end;
$$;

create function public.admin_restore_organizer(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  perform private.require_workspace(true);
  perform 1 from private.organizer_registration_link for update;
  select user_id into target from private.workspace_invitations where email = lower(trim(p_email)) and not active;
  if target is null then raise exception 'Revoked account unavailable' using errcode = '22023'; end if;
  update private.workspace_invitations set active = true where user_id = target;
  insert into public.organizers(id, granted_by) values(target, auth.uid()) on conflict do nothing;
end;
$$;

-- The old invitation function now only resolves authorized accounts for recovery.
create or replace function public.admin_prepare_organizer_invitation(p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target uuid; address text := lower(trim(p_email));
begin
  perform private.require_workspace(true);
  select u.id into target from auth.users u join public.organizers o on o.id = u.id where lower(u.email) = address;
  if target is null then raise exception 'Authorized account required' using errcode = '42501'; end if;
  return jsonb_build_object('email', address, 'user_id', target);
end;
$$;

revoke all on function public.admin_registration_link(text,boolean), public.admin_restore_organizer(text),
  public.admin_revoke_organizer(uuid,text), public.check_organizer_registration(text,text), public.redeem_organizer_registration(text,uuid) from public, anon, authenticated;
grant execute on function public.admin_registration_link(text,boolean), public.admin_restore_organizer(text), public.admin_revoke_organizer(uuid,text) to authenticated;
grant execute on function public.check_organizer_registration(text,text), public.redeem_organizer_registration(text,uuid) to service_role;

select cron.schedule('organizer-registration-cleanup', '*/15 * * * *',
  'delete from private.organizer_registration_pending where expires_at <= now(); delete from private.organizer_registration_attempts where started_at < now() - interval ''15 minutes'';');
