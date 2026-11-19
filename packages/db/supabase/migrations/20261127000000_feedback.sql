-- M3-13: coach feedback and athlete replies (K-Athlete, T-Feedback).
-- Clients never write these tables. give_feedback checks that the caller coaches the athlete in THAT program right
-- now (coach_reads_program); reply_feedback checks that the caller is the athlete. The athlete reads their feedback
-- for good, also after leaving or removal. The coach reads it per program, only while the athlete is active in it.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  -- Kept when the coach deletes their account or the program goes: the athlete keeps what they were told.
  coach_id uuid references public.profiles (id) on delete set null,
  program_id uuid references public.programs (id) on delete set null,
  log_id uuid references public.session_logs (id) on delete set null,
  -- Snapshots: the athlete cannot read the coach's profile, and keeps these after leaving or account deletion.
  coach_name text not null default '',
  program_title text not null default '',
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index feedback_athlete_idx on public.feedback (athlete_id, created_at desc);
create index feedback_program_idx on public.feedback (program_id);

create table public.feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index feedback_replies_feedback_idx on public.feedback_replies (feedback_id, created_at);

alter table public.feedback enable row level security;
alter table public.feedback_replies enable row level security;
create policy feedback_select_athlete on public.feedback for select to authenticated using (athlete_id = (select auth.uid()));
create policy feedback_select_coach on public.feedback for select to authenticated using (public.coach_reads_program(athlete_id, program_id));
-- Through the parent's policies, so replies follow the same rule.
create policy feedback_replies_select on public.feedback_replies for select to authenticated
  using (exists (select 1 from public.feedback f where f.id = feedback_id));
grant select on public.feedback, public.feedback_replies to authenticated;

-- The coach of an active enrollment gives feedback, optionally on one of its session logs. Returns the feedback.
create function public.give_feedback(enrollment uuid, body text, log uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.enrollments;
  text_ text := regexp_replace(coalesce(body, ''), '^\s+|\s+$', '', 'g');
  id_ uuid;
begin
  select * into e from public.enrollments where id = enrollment;
  if e.id is null or not public.coach_reads_program(e.athlete_id, e.program_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if char_length(text_) not between 1 and 2000 then
    raise exception 'bad_feedback' using errcode = '22023';
  end if;
  if log is not null and not exists (select 1 from public.session_logs l where l.id = log and l.athlete_id = e.athlete_id and l.program_id = e.program_id) then
    raise exception 'bad_log' using errcode = '22023';
  end if;
  insert into public.feedback (athlete_id, coach_id, program_id, log_id, body, coach_name, program_title)
  values (e.athlete_id, auth.uid(), e.program_id, log, text_,
    coalesce((select display_name from public.profiles where id = auth.uid()), ''),
    coalesce((select title from public.program_versions where id = public.version_in_effect(e.program_id, public.india_today())), ''))
  returning id into id_;
  return id_;
end;
$$;

-- The athlete answers their own feedback. Replies stay possible after leaving: the coach just no longer reads them.
create function public.reply_feedback(feedback uuid, body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  text_ text := regexp_replace(coalesce(body, ''), '^\s+|\s+$', '', 'g');
  id_ uuid;
begin
  if not exists (select 1 from public.feedback f where f.id = reply_feedback.feedback and f.athlete_id = auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if char_length(text_) not between 1 and 1000 then
    raise exception 'bad_reply' using errcode = '22023';
  end if;
  insert into public.feedback_replies (feedback_id, body) values (reply_feedback.feedback, text_) returning id into id_;
  return id_;
end;
$$;

revoke execute on function public.give_feedback(uuid, text, uuid), public.reply_feedback(uuid, text) from public, anon;
grant execute on function public.give_feedback(uuid, text, uuid), public.reply_feedback(uuid, text) to authenticated;

-- export_my_data as in 20261125000000_m3_review_fixes.sql, plus feedback and replies.
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
