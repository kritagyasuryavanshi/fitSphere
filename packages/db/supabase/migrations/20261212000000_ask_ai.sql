-- M5-04: the Ask AI screen's data. A pain question (the guide's referral) records a pain report the athlete's coach
-- sees on the dashboard; Add to Today puts published lessons on the athlete's day; the screen shows questions left.

create table public.pain_reports (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  reported_on date not null default public.india_today(),
  -- ai: a pain question to the guide. Logged sessions may report pain later.
  source text not null default 'ai' check (source in ('ai')),
  question_id uuid unique references public.ai_questions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index pain_reports_athlete_idx on public.pain_reports (athlete_id, reported_on);
alter table public.pain_reports enable row level security;
revoke all on public.pain_reports from anon, authenticated;
grant select on public.pain_reports to authenticated;
grant all on public.pain_reports to service_role;
-- The athlete, and a coach who can read the athlete (coach_can_read: an active enrollment in their program).
create policy pain_reports_select on public.pain_reports for select to authenticated
  using (athlete_id = (select auth.uid()) or public.coach_can_read(athlete_id));

create table public.today_extras (
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.content_items (id) on delete cascade,
  on_date date not null default public.india_today(),
  created_at timestamptz not null default now(),
  primary key (athlete_id, on_date, item_id)
);
alter table public.today_extras enable row level security;
revoke all on public.today_extras from anon, authenticated;
grant select on public.today_extras to authenticated;
grant all on public.today_extras to service_role;
create policy today_extras_select_own on public.today_extras for select to authenticated using (athlete_id = (select auth.uid()));

-- Adds published items to the signed-in athlete's today; returns how many were new. At most 10 a day.
create function public.add_to_today(items uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  added int;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not public.has_role('athlete') then
    raise exception 'not_athlete' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('today_extras:' || uid::text));
  with fresh as (
    insert into public.today_extras (athlete_id, item_id)
    select uid, c.id from public.content_items c
    where c.id = any (coalesce(items, '{}')) and c.status = 'published'
      and (select count(*) from public.today_extras t where t.athlete_id = uid and t.on_date = public.india_today()) < 10
    limit greatest(0, 10 - (select count(*) from public.today_extras t where t.athlete_id = uid and t.on_date = public.india_today()))::int
    on conflict do nothing
    returning 1
  )
  select count(*)::int into added from fresh;
  return added;
end;
$$;
revoke all on function public.add_to_today(uuid[]) from public;
grant execute on function public.add_to_today(uuid[]) to authenticated;

-- How many questions the signed-in athlete has left today, as reserve_ai_question counts them.
create function public.ai_questions_left()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, least(
    public.ai_daily_limit() - count(*) filter (where a.status <> 'failed'),
    2 * public.ai_daily_limit() - count(*)))::int
  from public.ai_questions a where a.user_id = auth.uid() and a.asked_on = public.india_today();
$$;
revoke all on function public.ai_questions_left() from public;
grant execute on function public.ai_questions_left() to authenticated;

-- finish_ai_question as in 20261211000000_ai_questions.sql, plus the pain report.
create or replace function public.finish_ai_question(question_id uuid, answer_kind text, answer_body jsonb, input_tokens int, output_tokens int, cost_micro_usd bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_questions a set
    status = case when answer_kind = 'unavailable' and coalesce(finish_ai_question.input_tokens, 0) = 0 and coalesce(finish_ai_question.output_tokens, 0) = 0
      then 'failed' else 'answered' end,
    kind = answer_kind, answer = answer_body,
    input_tokens = greatest(coalesce(finish_ai_question.input_tokens, 0), 0),
    output_tokens = greatest(coalesce(finish_ai_question.output_tokens, 0), 0),
    cost_micro_usd = greatest(coalesce(finish_ai_question.cost_micro_usd, 0), 0),
    answered_at = now()
  where a.id = question_id and a.status = 'pending';
  -- A pain or injury question (the guide's referral) tells the athlete's coach, through the dashboard's pain flag.
  if found and answer_kind = 'referral' then
    insert into public.pain_reports (athlete_id, question_id)
    select a.user_id, a.id from public.ai_questions a where a.id = question_id
    on conflict do nothing;
  end if;
end;
$$;

-- export_my_data as in 20261211000000_ai_questions.sql, plus pain reports and items added to Today.
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
        'status', g.status, 'requested_at', g.created_at, 'decided_at', g.decided_at, 'ended_at', g.ended_at) order by g.created_at)
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
