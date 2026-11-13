-- M2-04: lesson pages show "Reviewed by", so reviewers of published items get a public name too.
create or replace function public.author_names(ids uuid[])
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name from public.profiles p
  where p.id = any (ids[1:200])
    and exists (select 1 from public.content_items i where (i.author_id = p.id or i.reviewed_by = p.id) and i.status = 'published');
$$;
