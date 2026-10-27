-- Application revision conflicts must not use serialization_failure (40001):
-- PostgREST retries that code. PT409 returns a terminal HTTP 409 to the caller.
create or replace function public.save_member_work(p_group_id uuid, p_organizer_id uuid, p_working_on text, p_next_steps text, p_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_group_edit(p_group_id);
  update private.member_work set working_on = p_working_on, next_steps = p_next_steps,
    revision = revision + 1, updated_at = now(), updated_by = auth.uid()
    where group_id = p_group_id and organizer_id = p_organizer_id and revision = p_revision;
  if not found then raise exception 'Work changed; refresh before saving' using errcode = 'PT409'; end if;
end;
$$;

create or replace function public.admin_save_group(p_name text, p_mission text, p_group_id uuid default null, p_revision integer default null, p_archived boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_workspace(true);
  if p_group_id is null then
    insert into private.working_groups(name, mission) values (trim(p_name), trim(p_mission));
  else
    update private.working_groups set name = trim(p_name), mission = trim(p_mission), revision = revision + 1,
      archived_at = case when p_archived then coalesce(archived_at, now()) else null end
      where id = p_group_id and revision = p_revision;
    if not found then raise exception 'Group changed; refresh before saving' using errcode = 'PT409'; end if;
  end if;
end;
$$;
