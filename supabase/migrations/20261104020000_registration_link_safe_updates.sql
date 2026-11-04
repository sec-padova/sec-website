-- PostgREST enables safeupdate: even a singleton UPDATE must have a WHERE clause.
create or replace function public.admin_registration_link(p_hash text default null, p_revoke boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare issued_at timestamptz;
begin
  perform private.require_workspace(true);
  perform 1 from private.organizer_registration_link for update;
  if p_revoke then
    update private.organizer_registration_link set revoked_at = clock_timestamp() where singleton;
  elsif p_hash is not null then
    if p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid token hash'; end if;
    issued_at := clock_timestamp();
    update private.organizer_registration_link set token_hash = p_hash, created_by = auth.uid(),
      created_at = issued_at, expires_at = issued_at + interval '8 hours', revoked_at = null where singleton;
  end if;
  return (select jsonb_build_object('created_at', created_at, 'expires_at', expires_at, 'revoked_at', revoked_at) from private.organizer_registration_link);
end;
$$;
