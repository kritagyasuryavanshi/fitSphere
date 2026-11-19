-- M4-04: Find a coach. One read function for the directory (P-Coaches). It lists live coaches only, filters them, and
-- sorts by fixed keys. Nothing about payments or placement takes part in the order: the marketplace never sells rank.

create function public.find_coaches(
  specialty text default null,
  format text default null,
  city text default null,
  min_paise bigint default null,
  max_paise bigint default null,
  min_rating numeric default null,
  experience text default null,
  checked_only boolean default false,
  language text default null,
  sort text default 'best'
)
returns table (
  coach_id uuid, name text, headline text, specialties text[], formats text[], coach_city text, years smallint, languages text[],
  from_paise bigint, checked boolean, rating numeric, review_count int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if sort not in ('best', 'rating', 'price', 'checked') then
    raise exception 'bad_sort' using errcode = '22023';
  end if;
  if experience is not null and experience not in ('<5', '5-10', '10+') then
    raise exception 'bad_experience' using errcode = '22023';
  end if;
  return query
  with c as (
    select p.coach_id, pr.display_name as name, p.headline, p.specialties, p.formats, p.city, p.years, p.languages,
      (select min(k.price_paise) from public.packages k where k.coach_id = p.coach_id and k.live and k.kind = 'monthly') as from_paise,
      exists (select 1 from public.credentials cr where cr.coach_id = p.coach_id and cr.status = 'checked') as checked,
      -- shortcut: no reviews until M4-14, which redefines this function with the verified rating and count.
      null::numeric as rating, 0 as review_count
    from public.coach_profiles p
    join public.profiles pr on pr.id = p.coach_id
    where public.coach_is_live(p.coach_id)
  )
  select c.coach_id, c.name, c.headline, c.specialties, c.formats, c.city, c.years, c.languages, c.from_paise, c.checked, c.rating, c.review_count
  from c
  where (find_coaches.specialty is null or exists (select 1 from unnest(c.specialties) s where lower(s) = lower(btrim(find_coaches.specialty))))
    and (find_coaches.format is null or find_coaches.format = any (c.formats))
    and (find_coaches.city is null or lower(c.city) = lower(btrim(find_coaches.city)))
    and (min_paise is null or c.from_paise >= min_paise)
    and (max_paise is null or c.from_paise <= max_paise)
    and (min_rating is null or c.rating >= min_rating)
    and (experience is null
      or (experience = '<5' and c.years < 5)
      or (experience = '5-10' and c.years >= 5 and c.years < 10)
      or (experience = '10+' and c.years >= 10))
    and (not checked_only or c.checked)
    and (find_coaches.language is null or exists (select 1 from unnest(c.languages) l where lower(l) = lower(btrim(find_coaches.language))))
  order by
    case when sort = 'price' then c.from_paise end asc nulls last,
    case when sort = 'rating' then c.rating end desc nulls last,
    c.checked desc, c.years desc, c.coach_id
  -- shortcut: one page of 100; add paging when the directory outgrows it.
  limit 100;
end;
$$;

revoke all on function public.find_coaches(text, text, text, bigint, bigint, numeric, text, boolean, text, text) from public;
grant execute on function public.find_coaches(text, text, text, bigint, bigint, numeric, text, boolean, text, text) to anon, authenticated;
