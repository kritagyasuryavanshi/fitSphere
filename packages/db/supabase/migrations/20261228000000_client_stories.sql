-- M4-15: client stories with written consent (docs/plans/remaining-tasks-plan.md, agreed with Codex). The coach of
-- paid coaching drafts a story; every edit is a new revision that nobody can change. A story shows in public only
-- after the client approves that exact revision. Photos need a second approval of the same revision, live under
-- content-addressed keys that cannot be overwritten, and are served by 60-second signed links. Withdrawal hides the
-- story at once. Unapproved revisions and withdrawn stories are deleted after 30 days.

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null unique references public.engagements (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  -- The story is about the client: deleting either account deletes it.
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  current_rev int not null default 1,
  approved_rev int,
  photos_approved_rev int,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  check (photos_approved_rev is null or photos_approved_rev = approved_rev)
);
create table public.story_revisions (
  story_id uuid not null references public.stories (id) on delete cascade,
  rev int not null,
  body text not null check (char_length(body) between 20 and 2000),
  photo_keys text[] not null default '{}' check (cardinality(photo_keys) <= 3),
  created_at timestamptz not null default now(),
  primary key (story_id, rev)
);
alter table public.stories enable row level security;
alter table public.story_revisions enable row level security;
revoke all on public.stories, public.story_revisions from anon, authenticated;
grant select on public.stories, public.story_revisions to authenticated;
grant all on public.stories, public.story_revisions to service_role;
create policy stories_select_party on public.stories for select to authenticated
  using (coach_id = (select auth.uid()) or athlete_id = (select auth.uid()));
create policy story_revisions_select_party on public.story_revisions for select to authenticated
  using (exists (select 1 from public.stories s where s.id = story_id and (s.coach_id = (select auth.uid()) or s.athlete_id = (select auth.uid()))));

-- The coach saves a new revision; the first save makes the story. Returns the story id.
create function public.save_story(engagement uuid, body text, photo_keys text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g public.engagements;
  st public.stories;
  b text := btrim(coalesce(body, ''));
  keys text[] := coalesce(photo_keys, '{}');
begin
  select * into g from public.engagements where id = engagement for update;
  if uid is null or g.id is null or g.coach_id is distinct from uid or g.athlete_id is null then
    raise exception 'not_your_client' using errcode = '42501';
  end if;
  if not exists (select 1 from public.orders o where o.engagement_id = g.id and o.status = 'paid') then
    raise exception 'not_paid' using errcode = '22023';
  end if;
  if char_length(b) not between 20 and 2000 then
    raise exception 'bad_story' using errcode = '22023';
  end if;
  if cardinality(keys) > 3 or exists (select 1 from unnest(keys) k
      where k !~ ('^stories/' || g.id::text || '/[0-9a-f]{64}\.(jpg|png|webp)$')) then
    raise exception 'bad_photo' using errcode = '22023';
  end if;
  select * into st from public.stories where engagement_id = g.id for update;
  if st.id is null then
    insert into public.stories (engagement_id, coach_id, athlete_id) values (g.id, g.coach_id, g.athlete_id) returning * into st;
  else
    update public.stories set current_rev = current_rev + 1 where id = st.id returning * into st;
  end if;
  insert into public.story_revisions (story_id, rev, body, photo_keys) values (st.id, st.current_rev, b, keys);
  return st.id;
end;
$$;

-- The client approves the exact current revision. A withdrawn story can be approved again.
create function public.approve_story(story uuid, rev int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.stories;
begin
  select * into st from public.stories where id = story for update;
  if st.id is null or auth.uid() is null or st.athlete_id is distinct from auth.uid() then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if rev is distinct from st.current_rev then
    raise exception 'stale_revision' using errcode = '22023';
  end if;
  update public.stories set approved_rev = rev, photos_approved_rev = null, withdrawn_at = null where id = st.id;
  insert into public.audit_log (actor_id, action, target_id, details) values (auth.uid(), 'story_approved', st.id, jsonb_build_object('rev', rev));
end;
$$;

-- The client's separate consent to show the photos of the revision they approved.
create function public.approve_story_photos(story uuid, rev int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.stories;
begin
  select * into st from public.stories where id = story for update;
  if st.id is null or auth.uid() is null or st.athlete_id is distinct from auth.uid() then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  if st.approved_rev is null or rev is distinct from st.approved_rev or st.withdrawn_at is not null then
    raise exception 'stale_revision' using errcode = '22023';
  end if;
  update public.stories set photos_approved_rev = rev where id = st.id;
  insert into public.audit_log (actor_id, action, target_id, details) values (auth.uid(), 'story_photos_approved', st.id, jsonb_build_object('rev', rev));
end;
$$;

-- The client withdraws: the story stops showing at once.
create function public.withdraw_story(story uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.stories;
begin
  select * into st from public.stories where id = story for update;
  if st.id is null or auth.uid() is null or st.athlete_id is distinct from auth.uid() then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  update public.stories set approved_rev = null, photos_approved_rev = null, withdrawn_at = now() where id = st.id;
  insert into public.audit_log (actor_id, action, target_id, details) values (auth.uid(), 'story_withdrawn', st.id, '{}');
end;
$$;

-- Anyone: a live coach's approved stories, with the client named by first name and last initial.
create function public.public_stories(coach uuid)
returns table (id uuid, body text, author text, photo_count int, approved_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, r.body, public.review_author(s.athlete_id),
    case when s.photos_approved_rev = s.approved_rev then cardinality(r.photo_keys) else 0 end, r.created_at
  from public.stories s join public.story_revisions r on r.story_id = s.id and r.rev = s.approved_rev
  where s.coach_id = coach and s.approved_rev is not null and s.withdrawn_at is null and public.coach_is_live(coach)
  order by r.created_at desc
  limit 20;
$$;

-- Server only: the photo keys a viewer may see right now, checked again at the moment of each request.
create function public.story_photo_keys(story uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select r.photo_keys from public.stories s join public.story_revisions r on r.story_id = s.id and r.rev = s.approved_rev
  where s.id = story and s.withdrawn_at is null and s.photos_approved_rev = s.approved_rev and public.coach_is_live(s.coach_id);
$$;

-- Service role, daily: deletes withdrawn stories after 30 days, and revisions that were never approved and were
-- replaced more than 30 days ago. Returns the photo keys no remaining revision uses, for the storage clean-up.
create function public.prune_stories()
returns table (photo_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  gone text[];
begin
  -- Revisions to drop: every revision of a story withdrawn over 30 days ago, and revisions never approved that a
  -- newer one replaced over 30 days ago.
  create temp table dead_revs on commit drop as
    select r.story_id, r.rev, r.photo_keys from public.story_revisions r join public.stories s on s.id = r.story_id
    where (s.withdrawn_at is not null and s.withdrawn_at < now() - interval '30 days')
       or (r.rev < s.current_rev and r.rev is distinct from s.approved_rev
           and exists (select 1 from public.story_revisions n where n.story_id = r.story_id and n.rev = r.rev + 1 and n.created_at < now() - interval '30 days'));
  select coalesce(array_agg(distinct k), '{}') into gone from pg_temp.dead_revs d, unnest(d.photo_keys) k;
  delete from public.story_revisions r using pg_temp.dead_revs d where r.story_id = d.story_id and r.rev = d.rev;
  delete from public.stories s where s.withdrawn_at is not null and s.withdrawn_at < now() - interval '30 days';
  drop table pg_temp.dead_revs;
  -- Only keys no remaining revision still uses go to the storage clean-up.
  return query select k from unnest(gone) k where not exists (select 1 from public.story_revisions r where k = any (r.photo_keys));
  -- Also files no revision uses that are over a day old: an upload whose save failed, or stories removed with an
  -- account (Codex review). The cron deletes them through the storage API.
  return query select o.name from storage.objects o
    where o.bucket_id = 'story-photos' and o.created_at < now() - interval '1 day'
      and not exists (select 1 from public.story_revisions r where o.name = any (r.photo_keys))
      and not (o.name = any (gone));
end;
$$;

revoke all on function public.save_story(uuid, text, text[]), public.approve_story(uuid, int), public.approve_story_photos(uuid, int),
  public.withdraw_story(uuid), public.public_stories(uuid), public.story_photo_keys(uuid), public.prune_stories() from public, anon, authenticated;
grant execute on function public.save_story(uuid, text, text[]), public.approve_story(uuid, int), public.approve_story_photos(uuid, int),
  public.withdraw_story(uuid) to authenticated;
grant execute on function public.public_stories(uuid) to anon, authenticated;
grant execute on function public.story_photo_keys(uuid), public.prune_stories() to service_role;

-- Photos: a private bucket. A coach may add a file only inside the folder of their own client's engagement and never
-- replace or delete one (the key is the file's hash). The two people read their own; the public gets signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-photos', 'story-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);
create policy story_photos_insert_coach on storage.objects for insert to authenticated
  with check (bucket_id = 'story-photos' and (storage.foldername(name))[1] = 'stories'
    and exists (select 1 from public.engagements g where g.id::text = (storage.foldername(name))[2] and g.coach_id = (select auth.uid())));
create policy story_photos_select_party on storage.objects for select to authenticated
  using (bucket_id = 'story-photos' and (storage.foldername(name))[1] = 'stories'
    and exists (select 1 from public.engagements g where g.id::text = (storage.foldername(name))[2]
      and (g.coach_id = (select auth.uid()) or g.athlete_id = (select auth.uid()))));

-- export_my_data as in 20261219000000_export_money.sql, plus the person's client stories.
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
    -- Money: each payment with its refunds and the subscription; the refund note and who asked stay out (admin only).
    'payments', coalesce((select jsonb_agg(jsonb_build_object('package', g.package_title, 'kind', o.kind, 'amount_paise', o.amount_paise,
        'currency', o.currency, 'period_start', o.period_start, 'period_end', o.period_end, 'status', o.status,
        'created_at', o.created_at, 'paid_at', o.paid_at,
        'subscription_status', (select s.status from public.subscriptions s where s.engagement_id = g.id order by s.created_at desc limit 1),
        'refunds', coalesce((select jsonb_agg(jsonb_build_object('amount_paise', r.amount_paise, 'reason', r.reason, 'status', r.status,
            'at', r.created_at, 'processed_at', r.processed_at) order by r.created_at)
          from public.payments p join public.refunds r on r.payment_id = p.id where p.order_id = o.id), '[]'))
        order by o.created_at)
      from public.orders o join public.engagements g on g.id = o.engagement_id where g.athlete_id = uid), '[]'),
    'payouts', coalesce((select jsonb_agg(jsonb_build_object('gross_paise', x.gross_paise, 'fee_paise', x.fee_paise, 'net_paise', x.net_paise,
        'status', x.status, 'hold_until', x.hold_until, 'at', x.created_at) order by x.created_at)
      from public.payouts x where x.coach_id = uid), '[]'),
    -- M4-15: stories about the person or written by them, every revision, with the approvals.
    'stories', coalesce((select jsonb_agg(jsonb_build_object('role', case when s.athlete_id = uid then 'client' else 'coach' end,
        'current_rev', s.current_rev, 'approved_rev', s.approved_rev, 'photos_approved_rev', s.photos_approved_rev, 'withdrawn_at', s.withdrawn_at,
        'revisions', (select jsonb_agg(jsonb_build_object('rev', r.rev, 'body', r.body, 'photo_keys', r.photo_keys, 'at', r.created_at) order by r.rev)
          from public.story_revisions r where r.story_id = s.id)) order by s.created_at)
      from public.stories s where s.athlete_id = uid or s.coach_id = uid), '[]'),
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
