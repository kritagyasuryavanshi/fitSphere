-- M4-14: verified reviews and coach replies (docs/plans/m4-14-reviews.md). Only the athlete of coaching with a
-- finished paid period reviews it, once. Nobody edits or deletes a review through the app. The coach replies once, in
-- public. The rating everywhere is the average of visible reviews.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('coach_feedback', 'new_lesson', 'session_reminder', 'request_accepted', 'payment_due', 'new_request', 'request_declined',
    'request_withdrawn', 'new_message', 'payment_received', 'new_client', 'refund_processed', 'new_review', 'review_reply'));

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null unique references public.engagements (id),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  -- The words are the athlete's: deleting their account deletes the review.
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  technique text check (technique in ('excellent', 'good', 'okay')),
  feedback_speed text check (feedback_speed in ('excellent', 'good', 'okay')),
  value_for_money text check (value_for_money in ('excellent', 'good', 'okay')),
  body text not null check (char_length(body) between 1 and 1000),
  coach_reply text check (char_length(coach_reply) between 1 and 1000),
  replied_at timestamptz,
  -- Set by an admin from the report queue (M4-18). A hidden review is not shown and does not count.
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);
create index reviews_coach_idx on public.reviews (coach_id, created_at desc);
alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant all on public.reviews to service_role;
-- Read only: post_review and reply_review are the only writers, so nobody edits or deletes a review.
grant select on public.reviews to authenticated;
create policy reviews_select_party on public.reviews for select to authenticated
  using (athlete_id = (select auth.uid()) or coach_id = (select auth.uid()) or public.is_admin());

-- Whether this coaching has earned a review: not refunded, and at least one paid period ended before today.
create function public.review_eligible(g public.engagements)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select g.athlete_id is not null and g.coach_id is not null and g.status <> 'refunded'
    and exists (select 1 from public.orders o where o.engagement_id = g.id and o.status = 'paid' and o.period_end < public.india_today());
$$;

-- Whether the caller can review this coaching now: their own, eligible, and not yet reviewed.
create function public.can_review(engagement uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select public.review_eligible(g) and not exists (select 1 from public.reviews r where r.engagement_id = g.id)
    from public.engagements g where g.id = engagement and g.athlete_id = (select auth.uid())), false);
$$;

-- How a review names its author in public: first name and last initial, never more.
create function public.review_author(athlete uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when x.n = '' then 'FitSphere client'
    when strpos(x.n, ' ') = 0 then x.n
    else split_part(x.n, ' ', 1) || ' ' || upper(left(regexp_replace(x.n, '^.* ', ''), 1)) || '.'
  end
  from (select regexp_replace(btrim(coalesce((select display_name from public.profiles where id = athlete), '')), '\s+', ' ', 'g') as n) x;
$$;

-- The athlete reviews their coaching, once. Returns the review.
create function public.post_review(engagement uuid, rating smallint, body text, technique text default null,
  feedback_speed text default null, value_for_money text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  g public.engagements;
  text_ text := btrim(coalesce(body, ''));
  r uuid;
begin
  select * into g from public.engagements where id = engagement for update;
  if not found or auth.uid() is null or g.athlete_id is distinct from auth.uid() then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if rating is null or rating not between 1 and 5 then
    raise exception 'bad_rating' using errcode = '22023';
  end if;
  if char_length(text_) not between 1 and 1000 then
    raise exception 'bad_body' using errcode = '22023';
  end if;
  if coalesce(technique, 'okay') not in ('excellent', 'good', 'okay') or coalesce(feedback_speed, 'okay') not in ('excellent', 'good', 'okay')
    or coalesce(value_for_money, 'okay') not in ('excellent', 'good', 'okay') then
    raise exception 'bad_aspect' using errcode = '22023';
  end if;
  if exists (select 1 from public.reviews x where x.engagement_id = g.id) then
    raise exception 'already_reviewed' using errcode = '22023';
  end if;
  if not public.review_eligible(g) then
    raise exception 'not_eligible' using errcode = '22023';
  end if;
  insert into public.reviews (engagement_id, coach_id, athlete_id, rating, technique, feedback_speed, value_for_money, body)
  values (g.id, g.coach_id, g.athlete_id, rating, technique, feedback_speed, value_for_money, text_) returning id into r;
  insert into public.notifications (user_id, kind, title, body, link, ref)
  values (g.coach_id, 'new_review', 'New review', public.review_author(g.athlete_id) || ' reviewed ' || g.package_title || '.', '/coach/reviews', r::text)
  on conflict do nothing;
  return r;
end;
$$;

-- The coach replies to a review of their coaching, once. The reply cannot be changed.
create function public.reply_review(review uuid, reply text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.reviews;
  text_ text := btrim(coalesce(reply, ''));
begin
  select * into v from public.reviews where id = review for update;
  if not found or auth.uid() is null or v.coach_id is distinct from auth.uid() then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if char_length(text_) not between 1 and 1000 then
    raise exception 'bad_reply' using errcode = '22023';
  end if;
  if v.coach_reply is not null then
    raise exception 'already_replied' using errcode = '22023';
  end if;
  update public.reviews set coach_reply = text_, replied_at = now() where id = v.id;
  insert into public.notifications (user_id, kind, title, body, link, ref)
  values (v.athlete_id, 'review_reply', 'Your coach replied', 'Your coach replied to your review.', '/coaches/' || v.coach_id, v.id::text)
  on conflict do nothing;
end;
$$;

-- The rating of a coach: the average of visible reviews, to one decimal, and how many there are.
create function public.coach_rating(coach uuid)
returns table (rating numeric, review_count int)
language sql
stable
security definer
set search_path = ''
as $$
  select round(avg(r.rating)::numeric, 1), count(*)::int from public.reviews r where r.coach_id = coach and r.hidden_at is null;
$$;

-- The public reviews of a live coach, newest first. The author shows as first name and last initial; the athlete's id
-- is never returned.
create function public.coach_reviews(coach uuid, max_rows int default 20)
returns table (id uuid, author text, package_title text, months_paid int, created_at timestamptz, month text, rating smallint, technique text,
  feedback_speed text, value_for_money text, body text, coach_reply text, replied_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, public.review_author(r.athlete_id), g.package_title,
    (select count(*)::int from public.orders o where o.engagement_id = g.id and o.status = 'paid'),
    r.created_at, to_char(r.created_at at time zone 'Asia/Kolkata', 'Mon YYYY'), r.rating, r.technique, r.feedback_speed, r.value_for_money, r.body, r.coach_reply, r.replied_at
  from public.reviews r join public.engagements g on g.id = r.engagement_id
  where r.coach_id = coach and r.hidden_at is null and public.coach_is_live(coach)
  order by r.created_at desc, r.id
  limit least(greatest(coalesce(max_rows, 20), 1), 100);
$$;

-- find_coaches as in 20261205000000_shortlists.sql, with the verified rating and count.
create or replace function public.find_coaches(
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
      -- The verified rating (M4-14): the average of visible reviews.
      (select x.rating from public.coach_rating(p.coach_id) x) as rating,
      (select x.review_count from public.coach_rating(p.coach_id) x) as review_count
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

-- export_my_data as in 20261214000000_renewals.sql, plus the person's reviews and replies.
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
    'coaching', coalesce((select jsonb_agg(jsonb_build_object('coach', coalesce(nullif(p.display_name, ''), 'Coach'), 'package', g.package_title,
        'price_paise', g.price_paise, 'start_date', g.start_date, 'days_per_week', g.days_per_week, 'goals', g.goals, 'share_data', g.share_data,
        'status', g.status, 'requested_at', g.created_at, 'decided_at', g.decided_at, 'ended_at', g.ended_at,
        'cancel_reason', (select r.reason from public.cancel_reasons r where r.engagement_id = g.id)) order by g.created_at)
      from public.engagements g left join public.profiles p on p.id = g.coach_id where g.athlete_id = uid), '[]'),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('conversation', c.id,
        'from', case when m.sender_id = uid then 'You' else coalesce(nullif(p.display_name, ''), case when c.coach_id = m.sender_id then 'Coach' else 'Athlete' end) end,
        'body', m.body, 'at', m.created_at) order by c.id, m.id)
      from public.messages m join public.conversations c on c.id = m.conversation_id
      left join public.profiles p on p.id = m.sender_id
      where c.athlete_id = uid or c.coach_id = uid), '[]'),
    'ai_questions', coalesce((select jsonb_agg(jsonb_build_object('asked_on', q.asked_on, 'question', q.question, 'answer', q.answer ->> 'text',
        'kind', q.kind, 'at', q.created_at) order by q.created_at)
      from public.ai_questions q where q.user_id = uid), '[]'),
    'pain_reports', coalesce((select jsonb_agg(jsonb_build_object('on', p.reported_on, 'source', p.source) order by p.created_at)
      from public.pain_reports p where p.athlete_id = uid), '[]'),
    'added_to_today', coalesce((select jsonb_agg(jsonb_build_object('on', t.on_date, 'item', c.slug) order by t.created_at)
      from public.today_extras t join public.content_items c on c.id = t.item_id where t.athlete_id = uid), '[]'),
    'shortlist', coalesce((select jsonb_agg(jsonb_build_object('coach', s.coach_id, 'at', s.created_at) order by s.created_at)
      from public.shortlists s where s.athlete_id = uid), '[]'),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('package', g.package_title, 'rating', r.rating, 'technique', r.technique,
        'feedback_speed', r.feedback_speed, 'value_for_money', r.value_for_money, 'body', r.body, 'at', r.created_at,
        'coach_reply', r.coach_reply) order by r.created_at)
      from public.reviews r join public.engagements g on g.id = r.engagement_id where r.athlete_id = uid), '[]'),
    'review_replies', coalesce((select jsonb_agg(jsonb_build_object('reply', r.coach_reply, 'at', r.replied_at) order by r.replied_at)
      from public.reviews r where r.coach_id = uid and r.coach_reply is not null), '[]'),
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

revoke all on function public.review_eligible(public.engagements), public.review_author(uuid) from public, anon, authenticated;
revoke all on function public.can_review(uuid), public.post_review(uuid, smallint, text, text, text, text), public.reply_review(uuid, text) from public, anon;
grant execute on function public.can_review(uuid), public.post_review(uuid, smallint, text, text, text, text), public.reply_review(uuid, text) to authenticated;
revoke all on function public.coach_rating(uuid), public.coach_reviews(uuid, int) from public;
grant execute on function public.coach_rating(uuid), public.coach_reviews(uuid, int) to anon, authenticated;
