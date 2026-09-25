-- Auth owns credentials. This schema holds club data and exposes only approved,
-- opted-in members through a separate public projection.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- Names follow the University of Padova's published English department list:
-- https://www.unipd.it/en/dipartimenti (checked 25 September 2026).
create table public.unipd_departments (
  name text primary key check (length(trim(name)) between 1 and 150)
);

insert into public.unipd_departments (name) values
  ('Department of Agronomy, Food, Natural resources, Animals and Environment - DAFNAE'),
  ('Department of Cultural Heritage: Archaeology, History of Art, Cinema and Music - DBC'),
  ('Department of Biology - DiBio'),
  ('Department of Comparative Biomedicine and Food Science - BCA'),
  ('Department of Private Law and Critique of Law - DPCD'),
  ('Department of Public, International and European Union Law - DiPIC'),
  ('Department of Philosophy, Sociology, Education and Applied Psychology - FISPPA'),
  ('Department of Physics and Astronomy "Galileo Galilei" - DFA'),
  ('Department of Geosciences'),
  ('Department of Civil, Environmental and Architectural Engineering - ICEA'),
  ('Department of Information Engineering - DEI'),
  ('Department of Industrial Engineering - DII'),
  ('Department of Mathematics "Tullio Levi-Civita" - DM'),
  ('Department of Medicine - DIMED'),
  ('Department of Animal Medicine, Production and Health - MAPS'),
  ('Department of Molecular Medicine - DMM'),
  ('Department of Neuroscience - DNS'),
  ('Department of Developmental Psychology and Socialisation - DPSS'),
  ('Department of General Psychology - DPG'),
  ('Department of Women''s and Children''s Health - SDB'),
  ('Department of Biomedical Sciences - DSB'),
  ('Department of Cardiac, Thoracic and Vascular Sciences and Public Health'),
  ('Department of Chemical Sciences - DiSC'),
  ('Department of Surgery, Oncology and Gastroenterology - DiSCOG'),
  ('Department of Pharmaceutical and Pharmacological Sciences - DSF'),
  ('Department of Economics and Management "Marco Fanno" - DSEA'),
  ('Department of Political Science, Law and International Studies - SPGI'),
  ('Department of Statistical Sciences'),
  ('Department of Historical and Geographic Sciences and the Ancient World - DiSSGeA'),
  ('Department of Linguistic and Literary Studies - DiSLL'),
  ('Department of Technique and Management of Industrial Systems - DTG'),
  ('Department of Land, Environment, Agriculture and Forestry - TESAF');

create table public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (length(email) <= 320),
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text not null check (length(trim(last_name)) between 1 and 100),
  affiliation text not null check (affiliation in ('student', 'external')),
  department text constraint department_is_unipd references public.unipd_departments(name) on update cascade,
  school text check (school is null or length(trim(school)) between 1 and 150),
  bio text check (bio is null or length(bio) <= 800),
  github_url text check (github_url is null or length(github_url) <= 300),
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
  public_directory_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizers (
  id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null
);

create table public.member_directory (
  id uuid primary key references public.member_profiles(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  affiliation text not null,
  department text,
  school text,
  github_url text
);

revoke all on public.member_profiles from anon, authenticated;
revoke all on public.organizers from anon, authenticated;
revoke all on public.member_directory from anon, authenticated;
revoke all on public.unipd_departments from anon, authenticated;
grant select on public.member_profiles to authenticated;
grant update (first_name, last_name, affiliation, department, school, bio, github_url, public_directory_opt_in)
  on public.member_profiles to authenticated;
grant select on public.member_directory to anon, authenticated;
grant select on public.unipd_departments to anon, authenticated;

alter table public.member_profiles enable row level security;
alter table public.organizers enable row level security;
alter table public.member_directory enable row level security;
alter table public.unipd_departments enable row level security;

create function private.is_organizer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizers where id = (select auth.uid())
  );
$$;
revoke all on function private.is_organizer() from public, anon;
grant execute on function private.is_organizer() to authenticated;

create policy "members read own profile; organizers read all"
  on public.member_profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_organizer()));

create policy "members edit own public profile fields"
  on public.member_profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "directory contains public records only"
  on public.member_directory for select to anon, authenticated using (true);

create policy "everyone can list UniPd departments"
  on public.unipd_departments for select to anon, authenticated using (true);

create function private.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.set_profile_updated_at() from public, anon, authenticated;

create trigger member_profile_updated_at
  before update on public.member_profiles
  for each row execute function private.set_profile_updated_at();

create function private.sync_member_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.member_directory where id = old.id;
    return old;
  end if;

  if new.status = 'active' and new.public_directory_opt_in then
    insert into public.member_directory (id, first_name, last_name, affiliation, department, school, github_url)
    values (new.id, new.first_name, new.last_name, new.affiliation, new.department, new.school, new.github_url)
    on conflict (id) do update set
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      affiliation = excluded.affiliation,
      department = excluded.department,
      school = excluded.school,
      github_url = excluded.github_url;
  else
    delete from public.member_directory where id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_member_directory() from public, anon, authenticated;

create trigger sync_member_directory
  after insert or update or delete on public.member_profiles
  for each row execute function private.sync_member_directory();

create function private.create_member_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.member_profiles (id, email, first_name, last_name, affiliation, department, school)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    new.raw_user_meta_data ->> 'affiliation',
    nullif(trim(new.raw_user_meta_data ->> 'department'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'school'), '')
  );
  return new;
end;
$$;
revoke all on function private.create_member_profile() from public, anon, authenticated;

create trigger create_member_profile
  after insert on auth.users
  for each row execute function private.create_member_profile();

create function private.sync_member_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.member_profiles set email = new.email where id = new.id;
  return new;
end;
$$;
revoke all on function private.sync_member_email() from public, anon, authenticated;

create trigger sync_member_email
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.sync_member_email();

-- Bootstrap the first organizer with a one-time SQL insert by a project owner:
-- insert into public.organizers (id) values ('<existing auth.users id>');
