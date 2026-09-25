-- An interest request is only an email address. It does not create an Auth
-- user or member profile. The public API exposes a write-only, idempotent RPC.
create table private.club_interest (
  email text primary key check (length(email) between 3 and 320),
  requested_at timestamptz not null default now()
);

revoke all on private.club_interest from public, anon, authenticated;
alter table private.club_interest enable row level security;

create function public.join_interest_list(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(p_email));
begin
  if normalized_email is null
    or length(normalized_email) > 320
    or normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;

  insert into private.club_interest (email)
  values (normalized_email)
  on conflict (email) do nothing;
end;
$$;

revoke all on function public.join_interest_list(text) from public, anon, authenticated;
grant execute on function public.join_interest_list(text) to anon, authenticated;
