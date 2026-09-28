-- Keep contact numbers private and optional. Existing email-only submissions
-- continue to work through the default argument.
alter table private.club_interest
  add column phone_number text
  check (phone_number is null or phone_number ~ '^\+[1-9][0-9]{1,14}$');

-- Replace the original signature to avoid ambiguous RPC overloads.
drop function public.join_interest_list(text);

create function public.join_interest_list(p_email text, p_phone_number text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(p_email));
  normalized_phone text := nullif(trim(p_phone_number), '');
begin
  if normalized_email is null
    or length(normalized_email) > 320
    or normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;

  if normalized_phone is not null
    and normalized_phone !~ '^\+[1-9][0-9]{1,14}$' then
    raise exception 'Invalid phone number' using errcode = '22023';
  end if;

  insert into private.club_interest (email, phone_number)
  values (normalized_email, normalized_phone)
  -- An anonymous resubmission must not overwrite someone else's contact data.
  on conflict (email) do nothing;
end;
$$;

revoke all on function public.join_interest_list(text, text) from public, anon, authenticated;
grant execute on function public.join_interest_list(text, text) to anon, authenticated;
