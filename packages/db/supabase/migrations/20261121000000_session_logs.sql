-- M3-07: session logs (architecture 4.2). One log per athlete, scheduled session and date; one item log per drill.
-- Clients never write these tables: log_drill and finish_session check that the caller's active enrollment
-- schedules that session on that date. The athlete reads their own logs for good, also after leaving a program.
-- A coach reads them through coach_can_read, and only for programs they own, so a note meant for one coach never
-- reaches another. M3-08 adds set logs under item_logs.

create table public.session_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  -- Kept as a snapshot when the program or session goes away (a coach deleting their account keeps the program).
  program_id uuid references public.programs (id) on delete set null,
  session_id uuid references public.program_sessions (id) on delete set null,
  -- The India date the session was scheduled for.
  on_date date not null,
  title text not null default '' check (char_length(title) <= 120),
  category_id text not null references public.categories (id),
  -- When the first drill was saved; the player does not record when it was opened.
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  note text not null default '' check (char_length(note) <= 1000),
  unique (athlete_id, session_id, on_date)
);
create index session_logs_athlete_idx on public.session_logs (athlete_id, on_date);
create index session_logs_program_idx on public.session_logs (program_id);
create index session_logs_session_idx on public.session_logs (session_id);

create table public.item_logs (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.session_logs (id) on delete cascade,
  -- The drill's position in the session, which identifies it within a published version.
  position smallint not null,
  item_id uuid references public.content_items (id) on delete set null,
  type public.prescription_type not null,
  -- Rounds drills only.
  rounds_planned smallint check (rounds_planned between 1 and 30),
  rounds_done smallint check (rounds_done between 0 and 30 and rounds_done <= rounds_planned),
  technique smallint not null check (technique between 1 and 5),
  effort smallint not null check (effort between 1 and 10),
  note text not null default '' check (char_length(note) <= 500),
  logged_at timestamptz not null default now(),
  unique (log_id, position),
  check ((type = 'rounds') = (rounds_planned is not null and rounds_done is not null))
);
create index item_logs_item_idx on public.item_logs (item_id);

alter table public.session_logs enable row level security;
alter table public.item_logs enable row level security;

create policy session_logs_select_own on public.session_logs for select to authenticated using (athlete_id = (select auth.uid()));
create policy session_logs_select_coach on public.session_logs for select to authenticated
  using (public.coach_can_read(athlete_id) and public.owns_program(program_id));
-- Through the parent's policies, so item logs follow the same rule.
create policy item_logs_select on public.item_logs for select to authenticated
  using (exists (select 1 from public.session_logs l where l.id = log_id));

grant select on public.session_logs, public.item_logs to authenticated;

-- The caller's active enrollment that schedules this published session on this date, up to today.
-- The rule matches Today: the version in effect on the date, and week 1 day 1 on the start date.
create function public.scheduled_session(session uuid, on_date date)
returns table (program_id uuid, title text, category_id text, program_title text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, s.title, p.category_id, v.title
  from public.program_sessions s
  join public.program_versions v on v.id = s.version_id
  join public.programs p on p.id = v.program_id
  join public.enrollments e on e.program_id = p.id and e.athlete_id = auth.uid() and e.status = 'active'
  where s.id = session
    and v.published_at is not null
    and v.id = public.version_in_effect(p.id, on_date)
    and s.week <= v.weeks
    and e.start_date + (s.week - 1) * 7 + (s.day - 1) = on_date
    and on_date <= public.india_today();
$$;

-- Saves one drill of a scheduled session, opening the session's log on the first. Logging a drill again replaces it.
-- Returns the log.
create function public.log_drill(session uuid, on_date date, item_position int, rounds_done int, technique int, effort int, note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sched record;
  it public.session_items;
  planned int;
  log uuid;
begin
  select * into sched from public.scheduled_session(session, on_date);
  if not found then
    raise exception 'not_scheduled' using errcode = '22023';
  end if;
  select * into it from public.session_items where session_id = session and position = item_position;
  planned := case when it.type = 'rounds' then (it.prescription->>'rounds')::int end;
  if it.id is null
    or technique is null or technique not between 1 and 5
    or effort is null or effort not between 1 and 10
    or char_length(coalesce(note, '')) > 500
    -- Sets wait for the set logger (M3-08); a missing round count is a bad prescription, not a server error.
    or it.type = 'sets'
    or (it.type = 'rounds' and (planned is null or rounds_done is null or rounds_done not between 0 and planned)) then
    raise exception 'bad_log' using errcode = '22023';
  end if;

  insert into public.session_logs (athlete_id, program_id, session_id, on_date, title, category_id)
  values (auth.uid(), sched.program_id, session, on_date, sched.title, sched.category_id)
  -- By name: the on_date parameter would make a column list ambiguous.
  on conflict on constraint session_logs_athlete_id_session_id_on_date_key do update set title = excluded.title
  returning id into log;

  insert into public.item_logs (log_id, position, item_id, type, rounds_planned, rounds_done, technique, effort, note)
  values (log, item_position, it.item_id, it.type, planned, case when it.type = 'rounds' then rounds_done end, technique, effort, btrim(coalesce(note, '')))
  on conflict (log_id, position) do update set rounds_planned = excluded.rounds_planned, rounds_done = excluded.rounds_done,
    technique = excluded.technique, effort = excluded.effort, note = excluded.note, logged_at = now();
  return log;
end;
$$;

-- Marks a scheduled session done. At least one drill must be logged; skipped drills have no item log.
create function public.finish_session(session uuid, on_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  log uuid;
begin
  if not exists (select 1 from public.scheduled_session(session, on_date)) then
    raise exception 'not_scheduled' using errcode = '22023';
  end if;
  select l.id into log from public.session_logs l
  where l.athlete_id = auth.uid() and l.session_id = session and l.on_date = finish_session.on_date
    and exists (select 1 from public.item_logs i where i.log_id = l.id)
  for update;
  if log is null then
    raise exception 'nothing_logged' using errcode = '22023';
  end if;
  update public.session_logs set completed_at = coalesce(completed_at, now()) where id = log;
  return log;
end;
$$;

revoke execute on function public.scheduled_session(uuid, date), public.log_drill(uuid, date, int, int, int, int, text),
  public.finish_session(uuid, date) from public, anon;
grant execute on function public.scheduled_session(uuid, date), public.log_drill(uuid, date, int, int, int, int, text),
  public.finish_session(uuid, date) to authenticated;

-- export_my_data as in 20261114100000_invites.sql, plus training logs.
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
    'programs', coalesce((select jsonb_agg(jsonb_build_object('program', p.title, 'status', e.status, 'start_date', e.start_date,
        'joined_at', e.joined_at, 'ended_at', e.ended_at) order by e.joined_at)
      from public.enrollments e join public.programs p on p.id = e.program_id where e.athlete_id = uid), '[]'),
    'training_logs', coalesce((select jsonb_agg(to_jsonb(l) - 'athlete_id' || jsonb_build_object('items',
        coalesce((select jsonb_agg(to_jsonb(i) - 'log_id' order by i.position) from public.item_logs i where i.log_id = l.id), '[]'))
        order by l.on_date, l.started_at)
      from public.session_logs l where l.athlete_id = uid), '[]'),
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
