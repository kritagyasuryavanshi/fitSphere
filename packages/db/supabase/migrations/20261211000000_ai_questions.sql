-- M5-03: the AI guide's daily question limit and usage log (design doc: cost control). Each question is one row: the
-- question, the answer (for the athlete's history, M5-04), and the tokens and cost it used.

-- Questions per athlete per India day. shortcut: one limit for everyone; Free, Plus and Pro tiers set their own later.
create function public.ai_daily_limit()
returns int
language sql
immutable
set search_path = ''
as $$
  select 10;
$$;
revoke all on function public.ai_daily_limit() from public;
grant execute on function public.ai_daily_limit() to anon, authenticated, service_role;

create table public.ai_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  asked_on date not null default public.india_today(),
  question text not null check (char_length(question) between 1 and 500),
  -- pending: being answered; answered; failed: the guide could not answer and no tokens were used, so it gives the
  -- question back. A failure that used tokens is marked answered: it cost money, so it counts.
  status text not null default 'pending' check (status in ('pending', 'answered', 'failed')),
  kind text check (kind in ('answer', 'no_source', 'referral', 'refused', 'unavailable')),
  answer jsonb,
  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  -- US dollars in millionths, at the model's list price when asked.
  cost_micro_usd bigint not null default 0 check (cost_micro_usd >= 0),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index ai_questions_user_day_idx on public.ai_questions (user_id, asked_on);

alter table public.ai_questions enable row level security;
revoke all on public.ai_questions from anon, authenticated;
grant select on public.ai_questions to authenticated;
grant all on public.ai_questions to service_role;
create policy ai_questions_select_own on public.ai_questions for select to authenticated using (user_id = (select auth.uid()));

-- Takes one of today's questions for the signed-in athlete, or refuses the one past the limit. Every question counts
-- except a failure that cost nothing; a question being answered counts too (the server always finishes what it
-- reserves). However questions end, at most twice the limit can be started in a day, so failures cannot run up cost.
create function public.reserve_ai_question(question text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  q text := btrim(coalesce(question, ''));
  id_ uuid;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not public.has_role('athlete') then
    raise exception 'not_athlete' using errcode = '42501';
  end if;
  if char_length(q) not between 1 and 500 then
    raise exception 'bad_question' using errcode = '22023';
  end if;
  -- One at a time per athlete, so two quick questions cannot both take the last place.
  perform pg_advisory_xact_lock(hashtext('ai_questions:' || uid::text));
  if (select count(*) filter (where a.status <> 'failed') >= public.ai_daily_limit() or count(*) >= 2 * public.ai_daily_limit()
      from public.ai_questions a where a.user_id = uid and a.asked_on = public.india_today()) then
    raise exception 'ai_daily_limit' using errcode = '22023';
  end if;
  insert into public.ai_questions (user_id, question) values (uid, q) returning id into id_;
  return id_;
end;
$$;
revoke all on function public.reserve_ai_question(text) from public;
grant execute on function public.reserve_ai_question(text) to authenticated;

-- Service role only: records the answer and what it used. An unavailable answer that used no tokens marks the question
-- failed (given back); one that used tokens still counts.
create function public.finish_ai_question(question_id uuid, answer_kind text, answer_body jsonb, input_tokens int, output_tokens int, cost_micro_usd bigint)
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
end;
$$;
revoke all on function public.finish_ai_question(uuid, text, jsonb, int, int, bigint) from public, anon, authenticated;
grant execute on function public.finish_ai_question(uuid, text, jsonb, int, int, bigint) to service_role;

-- export_my_data as in 20261207000000_messages.sql, plus the athlete's AI questions and answers.
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
