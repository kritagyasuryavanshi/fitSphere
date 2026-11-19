-- M4-06: shortlist and compare. A shortlist is private to its athlete; the coach is never told.

create table public.shortlists (
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.coach_profiles (coach_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (athlete_id, coach_id)
);
create index shortlists_coach_idx on public.shortlists (coach_id);

alter table public.shortlists enable row level security;
revoke all on public.shortlists from anon, authenticated;
grant select on public.shortlists to authenticated;
create policy shortlists_select_own on public.shortlists for select to authenticated using (athlete_id = (select auth.uid()));

-- Adds (on) or removes (off) a coach. Athletes only. Only live coaches go on, never yourself, at most 20 live ones: a coach
-- who stops being live stays on the list, so it can be removed, but no longer takes a place.
create function public.shortlist_coach(coach uuid, on_list boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if on_list is null then
    raise exception 'bad_input' using errcode = '22023';
  end if;
  if not public.has_role('athlete') then
    raise exception 'not_athlete' using errcode = '42501';
  end if;
  if not on_list then
    delete from public.shortlists where athlete_id = uid and coach_id = coach;
    return;
  end if;
  if coach = uid then
    raise exception 'own_profile' using errcode = '22023';
  end if;
  if not public.coach_is_live(coach) then
    raise exception 'not_live' using errcode = '22023';
  end if;
  -- One change at a time per athlete, so two quick taps cannot pass the cap together.
  perform pg_advisory_xact_lock(hashtext('shortlist:' || uid::text));
  if (select count(*) from public.shortlists where athlete_id = uid and coach_id <> coach and public.coach_is_live(coach_id)) >= 20 then
    raise exception 'shortlist_full' using errcode = '22023';
  end if;
  insert into public.shortlists (athlete_id, coach_id) values (uid, coach) on conflict do nothing;
end;
$$;

revoke all on function public.shortlist_coach(uuid, boolean) from public;
grant execute on function public.shortlist_coach(uuid, boolean) to authenticated;

-- find_coaches as in 20261203000000_find_coaches.sql, plus ids: the shortlist and compare pages read chosen coaches.
drop function public.find_coaches(text, text, text, bigint, bigint, numeric, text, boolean, text, text);

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
  sort text default 'best',
  ids uuid[] default null
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
    select p.coach_id, coalesce(nullif(pr.display_name, ''), 'Coach') as name, p.headline, p.specialties, p.formats, p.city, p.years, p.languages,
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
    -- Any live monthly package in the range counts; the card still shows the lowest.
    and ((min_paise is null and max_paise is null) or exists (
      select 1 from public.packages k where k.coach_id = c.coach_id and k.live and k.kind = 'monthly'
        and (min_paise is null or k.price_paise >= min_paise) and (max_paise is null or k.price_paise <= max_paise)))
    and (min_rating is null or c.rating >= min_rating)
    and (experience is null
      or (experience = '<5' and c.years < 5)
      or (experience = '5-10' and c.years >= 5 and c.years < 10)
      or (experience = '10+' and c.years >= 10))
    and (not checked_only or c.checked)
    and (ids is null or c.coach_id = any (ids))
    and (find_coaches.language is null or exists (select 1 from unnest(c.languages) l where lower(l) = lower(btrim(find_coaches.language))))
  order by
    case when sort = 'price' then c.from_paise end asc nulls last,
    case when sort = 'rating' then c.rating end desc nulls last,
    c.checked desc, c.years desc, c.coach_id
  -- shortcut: one page of 100; add paging when the directory outgrows it.
  limit 100;
end;
$$;

revoke all on function public.find_coaches(text, text, text, bigint, bigint, numeric, text, boolean, text, text, uuid[]) from public;
grant execute on function public.find_coaches(text, text, text, bigint, bigint, numeric, text, boolean, text, text, uuid[]) to anon, authenticated;

-- export_my_data as in 20261130000000_marketplace_profiles.sql, plus the shortlist.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'email', (select email from auth.users where id = uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'roles', coalesce((select jsonb_agg(r.role order by r.role) from public.user_roles r where r.user_id = uid), '[]'),
    'sports', coalesce((select jsonb_agg(jsonb_build_object('sport', a.category_id, 'answers', a.answers)) from public.athlete_prefs a where a.user_id = uid), '[]'),
    'training', (select to_jsonb(b) - 'user_id' from public.athlete_basics b where b.user_id = uid),
    'body_metrics', coalesce((select jsonb_agg(to_jsonb(m) - 'user_id' order by m.measured_at) from public.body_metrics m where m.user_id = uid), '[]'),
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.created_at) from public.consents c where c.user_id = uid), '[]'),
    'coach_applications', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' - 'decided_by' order by x.created_at) from public.coach_applications x where x.user_id = uid), '[]'),
    'saved', coalesce((select jsonb_agg(jsonb_build_object('item', c.slug, 'at', s.created_at) order by s.created_at)
      from public.saves s join public.content_items c on c.id = s.item_id where s.user_id = uid), '[]'),
    'completed', coalesce((select jsonb_agg(jsonb_build_object('item', c.slug, 'at', s.created_at) order by s.created_at)
      from public.completions s join public.content_items c on c.id = s.item_id where s.user_id = uid), '[]'),
    'programs', coalesce((select jsonb_agg(jsonb_build_object('program', coalesce((select v.title from public.program_versions v where v.id = public.version_in_effect(p.id, public.india_today())), ''), 'status', e.status, 'start_date', e.start_date,
        'joined_at', e.joined_at, 'ended_at', e.ended_at) order by e.joined_at)
      from public.enrollments e join public.programs p on p.id = e.program_id where e.athlete_id = uid), '[]'),
    'training_logs', coalesce((select jsonb_agg(to_jsonb(l) - 'athlete_id' || jsonb_build_object('items',
        coalesce((select jsonb_agg(to_jsonb(i) - 'log_id' || jsonb_build_object('sets',
            coalesce((select jsonb_agg(to_jsonb(x) - 'item_log_id' order by x.set_no) from public.set_logs x where x.item_log_id = i.id), '[]'))
          order by i.position) from public.item_logs i where i.log_id = l.id), '[]'))
        order by l.on_date, l.started_at)
      from public.session_logs l where l.athlete_id = uid), '[]'),
    'feedback', coalesce((select jsonb_agg(jsonb_build_object('at', f.created_at, 'coach', f.coach_name, 'program', f.program_title, 'body', f.body,
        'replies', coalesce((select jsonb_agg(jsonb_build_object('at', r.created_at, 'body', r.body) order by r.created_at) from public.feedback_replies r where r.feedback_id = f.id), '[]'))
        order by f.created_at)
      from public.feedback f where f.athlete_id = uid), '[]'),
    'email_prefs', (select to_jsonb(p) - 'user_id' from public.email_prefs p where p.user_id = uid),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'title', n.title, 'body', n.body, 'at', n.created_at, 'read_at', n.read_at) order by n.created_at)
      from public.notifications n where n.user_id = uid), '[]'),
    'coach', (select to_jsonb(cp) - 'coach_id' - 'payout_account_id' || jsonb_build_object(
        'packages', coalesce((select jsonb_agg(to_jsonb(p) - 'coach_id' order by p.created_at) from public.packages p where p.coach_id = uid), '[]'),
        'slots', coalesce((select jsonb_agg(to_jsonb(a) - 'coach_id' - 'id' order by a.dow, a.start_time) from public.availability_slots a where a.coach_id = uid), '[]'),
        'credentials', coalesce((select jsonb_agg(to_jsonb(c) - 'coach_id' - 'decided_by' order by c.created_at) from public.credentials c where c.coach_id = uid), '[]'))
      from public.coach_profiles cp where cp.coach_id = uid),
    'shortlist', coalesce((select jsonb_agg(jsonb_build_object('coach', s.coach_id, 'at', s.created_at) order by s.created_at)
      from public.shortlists s where s.athlete_id = uid), '[]'),
    'account_created_at', (select created_at from auth.users where id = uid),
    'last_sign_in_at', (select last_sign_in_at from auth.users where id = uid),
    'queued_emails', coalesce((select jsonb_agg(jsonb_build_object('to', o.to_email, 'template', o.template, 'data', o.data, 'created_at', o.created_at, 'sent_at', o.sent_at) order by o.id)
      from public.email_outbox o where o.user_id = uid or lower(o.to_email) = lower((select email from auth.users where id = uid))), '[]'),
    -- Role changes about the person, by action and time; the other party shows only as an id.
    'audit_events', coalesce((select jsonb_agg(jsonb_build_object('action', l.action, 'details', l.details, 'at', l.created_at) order by l.id)
      from public.audit_log l where l.target_id = uid), '[]')
  );
end;
$$;
