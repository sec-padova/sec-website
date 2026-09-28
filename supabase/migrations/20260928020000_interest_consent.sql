-- Existing entries have no recorded consent. Do not manufacture consent
-- retrospectively; organizers must review these separately before using them.
alter table private.club_interest
  add column privacy_notice_version text,
  add column consented_at timestamptz,
  add constraint interest_consent_fields_paired
    check ((privacy_notice_version is null) = (consented_at is null)),
  add constraint interest_notice_version_format
    check (privacy_notice_version is null or privacy_notice_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');

-- Remove the old entry point so direct API calls cannot skip consent.
drop function public.join_interest_list(text, text);

create function public.join_interest_list(
  p_email text,
  p_phone_number text,
  p_privacy_notice_version text,
  p_consent boolean
)
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

  if p_consent is distinct from true then
    raise exception 'Consent is required' using errcode = '22023';
  end if;

  if p_privacy_notice_version is distinct from '2026-09-28' then
    raise exception 'Invalid privacy notice version' using errcode = '22023';
  end if;

  insert into private.club_interest (email, phone_number, privacy_notice_version, consented_at)
  values (normalized_email, normalized_phone, p_privacy_notice_version, now())
  -- Preserve the original contact details and consent evidence on duplicates.
  on conflict (email) do nothing;
end;
$$;

revoke all on function public.join_interest_list(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.join_interest_list(text, text, text, boolean) to anon, authenticated;
