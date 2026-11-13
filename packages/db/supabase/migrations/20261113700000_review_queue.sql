-- M2-09: the review queue shows who wrote each item, so reviewers also get names for items in review.
create or replace function public.author_names(ids uuid[])
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name from public.profiles p
  where p.id = any (ids[1:200])
    and exists (
      select 1 from public.content_items i
      where (i.author_id = p.id or i.reviewed_by = p.id)
        and (i.status = 'published'
             or (i.status in ('in_review', 'needs_changes') and (public.has_role('reviewer') or public.is_admin())))
    );
$$;
