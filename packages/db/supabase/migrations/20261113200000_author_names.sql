-- M2-03: every item shows its author coach, but profiles are private.
-- This returns names only for people who have a published item.
create function public.author_names(ids uuid[])
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name from public.profiles p
  where p.id = any (ids[1:200])
    and exists (select 1 from public.content_items i where i.author_id = p.id and i.status = 'published');
$$;
revoke execute on function public.author_names(uuid[]) from public;
grant execute on function public.author_names(uuid[]) to anon, authenticated;
