-- M3-16: in-app notifications and email switches per event. Notifications are written only by triggers and server
-- functions; each user reads their own. Events now: coach feedback, a new lesson from the athlete's coach, and today's
-- session. request_accepted and payment_due are reserved for M4 (marketplace); payment receipts there always email.
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('coach_feedback', 'new_lesson', 'session_reminder', 'request_accepted', 'payment_due')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 500),
  link text not null default '',
  -- What the notification is about, so one event never notifies twice (a feedback or lesson id, a date).
  ref text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create unique index notifications_once on public.notifications (user_id, kind, ref) where ref is not null;
alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- Marks the caller's notifications read: these ids, or all of them. Returns how many changed.
create function public.mark_notifications_read(ids bigint[] default null)
returns int
language sql
security definer
set search_path = ''
as $$
  with done as (
    update public.notifications set read_at = now()
    where user_id = auth.uid() and read_at is null and (ids is null or id = any(ids))
    returning 1
  )
  select count(*)::int from done;
$$;

-- Email switches per event. Feedback and lesson emails start on; a daily session reminder by email starts off.
alter table public.email_prefs add column new_lesson boolean not null default true, add column session_reminder boolean not null default false;

-- Whether this person wants this email, with the defaults when they never changed a switch. Other templates
-- (coach application decisions, later payment receipts) always send.
create function public.email_wanted(person uuid, template text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case template
    when 'coach_feedback' then coalesce((select p.coach_feedback from public.email_prefs p where p.user_id = person), true)
    when 'new_lesson' then coalesce((select p.new_lesson from public.email_prefs p where p.user_id = person), true)
    when 'session_reminder' then coalesce((select p.session_reminder from public.email_prefs p where p.user_id = person), false)
    else true
  end;
$$;
revoke execute on function public.email_wanted(uuid, text) from public, anon, authenticated;

drop function public.my_email_prefs();
create function public.my_email_prefs()
returns table (coach_feedback boolean, new_lesson boolean, session_reminder boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select public.email_wanted(auth.uid(), 'coach_feedback'), public.email_wanted(auth.uid(), 'new_lesson'), public.email_wanted(auth.uid(), 'session_reminder');
$$;

create or replace function public.set_email_pref(kind text, enabled boolean)
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
  if kind is null or kind not in ('coach_feedback', 'new_lesson', 'session_reminder') or enabled is null then
    raise exception 'bad_pref' using errcode = '22023';
  end if;
  insert into public.email_prefs (user_id) values (uid) on conflict (user_id) do nothing;
  update public.email_prefs set
    coach_feedback = case when kind = 'coach_feedback' then enabled else coach_feedback end,
    new_lesson = case when kind = 'new_lesson' then enabled else new_lesson end,
    session_reminder = case when kind = 'session_reminder' then enabled else session_reminder end,
    updated_at = now()
  where user_id = uid;
end;
$$;
revoke execute on function public.my_email_prefs(), public.set_email_pref(text, boolean) from public, anon;
grant execute on function public.my_email_prefs(), public.set_email_pref(text, boolean) to authenticated;

-- Feedback notifies the athlete in the app; its email is queued by give_feedback.
create function public.notify_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, link, ref)
  values (new.athlete_id, 'coach_feedback', left(coalesce(nullif(new.coach_name, ''), 'Your coach') || ' sent you feedback', 200),
    left(new.body, 140), '/account/feedback', new.id::text)
  on conflict do nothing;
  return new;
end;
$$;
create trigger feedback_notify after insert on public.feedback for each row execute function public.notify_feedback();

-- A lesson going live notifies the athletes now in a program of its author, in the app and by email if wanted.
create function public.notify_new_lesson()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  coach text := coalesce((select nullif(display_name, '') from public.profiles where id = new.author_id), 'Your coach');
  link_ text := coalesce('/learn/' || (select d.category_id from public.disciplines d where d.id = new.discipline_id) || '/' || new.slug, '/learn');
  a record;
begin
  for a in
    select distinct e.athlete_id from public.enrollments e join public.programs p on p.id = e.program_id
    where p.coach_id = new.author_id and e.status = 'active' and e.athlete_id <> new.author_id
  loop
    insert into public.notifications (user_id, kind, title, body, link, ref)
    values (a.athlete_id, 'new_lesson', left('New lesson from ' || coach || ': ' || new.title, 200), '', link_, new.id::text)
    on conflict do nothing;
    if found and public.email_wanted(a.athlete_id, 'new_lesson') then
      insert into public.email_outbox (user_id, to_email, template, data)
      select a.athlete_id, u.email, 'new_lesson', jsonb_build_object('coach', coach, 'title', new.title, 'link', link_)
      from auth.users u where u.id = a.athlete_id and u.email is not null;
    end if;
  end loop;
  return new;
end;
$$;
create trigger content_items_notify_new_lesson after update of status on public.content_items for each row
  when (new.status = 'published' and old.status is distinct from 'published' and new.author_id is not null)
  execute function public.notify_new_lesson();

-- The daily job (server only): one reminder per athlete with an unfinished session scheduled today, by the same
-- schedule rule as Today and adherence. Returns how many athletes it reminded.
create function public.queue_session_reminders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.india_today();
  n int := 0;
  r record;
begin
  for r in
    select e.athlete_id, min(coalesce(nullif(s.title, ''), v.title)) as what
    from public.enrollments e
    join public.program_versions v on v.id = public.version_in_effect(e.program_id, today)
    join public.program_sessions s on s.version_id = v.id and s.week <= v.weeks
      and e.start_date + (s.week - 1) * 7 + (s.day - 1) = today
    where e.status = 'active'
      and not exists (select 1 from public.session_logs l
        where l.athlete_id = e.athlete_id and l.session_id = s.id and l.on_date = today and l.completed_at is not null)
    group by e.athlete_id
  loop
    insert into public.notifications (user_id, kind, title, body, link, ref)
    values (r.athlete_id, 'session_reminder', left('Today: ' || r.what, 200), 'Your session is ready on Today.', '/today', today::text)
    on conflict do nothing;
    if found then
      n := n + 1;
      if public.email_wanted(r.athlete_id, 'session_reminder') then
        insert into public.email_outbox (user_id, to_email, template, data)
        select r.athlete_id, u.email, 'session_reminder', jsonb_build_object('what', r.what)
        from auth.users u where u.id = r.athlete_id and u.email is not null;
      end if;
    end if;
  end loop;
  return n;
end;
$$;
revoke execute on function public.notify_feedback(), public.notify_new_lesson(), public.queue_session_reminders() from public, anon, authenticated;
grant execute on function public.queue_session_reminders() to service_role;
revoke execute on function public.mark_notifications_read(bigint[]) from public, anon;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;

-- claim_emails as in 20261128000000_feedback_email.sql, checking every switch through email_wanted.
create or replace function public.claim_emails(templates text[], max_rows int default 50)
returns setof public.email_outbox
language sql
security definer
set search_path = ''
as $$
  update public.email_outbox o set claimed_at = now(), attempts = o.attempts + 1
  where o.id in (
    select x.id from public.email_outbox x
    where x.sent_at is null and x.template = any(templates) and x.attempts < 5
      and (x.claimed_at is null or x.claimed_at < now() - interval '10 minutes')
      -- Stale after 7 days: news that old would mislead (an approval since revoked, say).
      and x.created_at > now() - interval '7 days'
      -- The switches count at sending too, so turning one off also stops what was already queued.
      and public.email_wanted(x.user_id, x.template)
    order by x.created_at
    limit least(greatest(max_rows, 1), 200)
    for update skip locked
  )
  returning o.*;
$$;

-- export_my_data as in 20261128000000_feedback_email.sql, plus notifications.
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
