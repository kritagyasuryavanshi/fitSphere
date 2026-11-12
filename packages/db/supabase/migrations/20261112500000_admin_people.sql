-- M1-06: admin people and roles (R-Roles).

-- Lists people for the admin screen, with email from auth.users, which no client can read directly.
create function public.admin_list_people(search text)
returns table (id uuid, display_name text, email text, roles public.app_role[], joined timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pattern text := '%' || replace(replace(replace(btrim(coalesce(search, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if not public.is_admin() then
    raise exception 'only an admin can list people' using errcode = '42501';
  end if;
  return query
    select p.id, p.display_name, u.email::text,
      coalesce((select array_agg(r.role order by r.role) from public.user_roles r where r.user_id = p.id), '{}'),
      p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.display_name ilike pattern or u.email ilike pattern
    order by p.created_at desc
    -- shortcut: the first 200 matches; add paging when the user count needs it.
    limit 200;
end;
$$;

-- Sets one person's roles to exactly this list in one transaction. It goes through grant_role and revoke_role,
-- so the admin check, the "nobody changes their own roles" rule and the audit trigger all still apply.
-- expected_roles are the roles the admin's page showed. If they differ from what the person holds now,
-- another admin changed them in the meantime, and the save is refused rather than silently undoing that change.
create function public.admin_set_roles(target uuid, new_roles public.app_role[], expected_roles public.app_role[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.app_role;
  held public.app_role[];
begin
  if not public.is_admin() then
    raise exception 'only an admin can set roles' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'nobody can change their own roles' using errcode = '42501';
  end if;
  -- Nobody is left with no role: that person could open nothing. A real suspend feature can come later.
  if coalesce(cardinality(new_roles), 0) = 0 or array_position(new_roles, null) is not null then
    raise exception 'roles_required' using errcode = '22023';
  end if;

  perform 1 from public.profiles where id = target for update;
  select coalesce(array_agg(role order by role), '{}') into held from public.user_roles where user_id = target;
  if held is distinct from (select coalesce(array_agg(distinct x order by x), '{}') from unnest(expected_roles) x) then
    raise exception 'roles_changed' using errcode = '40001';
  end if;

  for r in select role from public.user_roles where user_id = target and role <> all (new_roles) order by role loop
    perform public.revoke_role(target, r);
  end loop;
  for r in select distinct x from unnest(new_roles) x where x <> all (held) order by x loop
    perform public.grant_role(target, r);
  end loop;
end;
$$;

revoke execute on function public.admin_list_people(text), public.admin_set_roles(uuid, public.app_role[], public.app_role[]) from public, anon;
grant execute on function public.admin_list_people(text), public.admin_set_roles(uuid, public.app_role[], public.app_role[]) to authenticated;

-- grant_role and revoke_role become internal: only admin_set_roles (security definer) calls them. Otherwise an admin
-- could skip its rules with a direct call, for example leave someone with no role or overwrite a stale change.
revoke execute on function public.grant_role(uuid, public.app_role), public.revoke_role(uuid, public.app_role) from authenticated;
