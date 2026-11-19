-- M3-08: set logs for S&C and gym. Each set of a 'sets' exercise logs reps, load and effort (RPE 1-10), one call
-- per set, so a phone that dies mid-workout keeps every set already done. Sets sit under the exercise's item log
-- and follow the session log's readers. M3-10 counts hard sets from the effort here.

-- An exercise's item log has no technique or drill effort; those belong to rounds and timed drills.
alter table public.item_logs alter column technique drop not null, alter column effort drop not null;
alter table public.item_logs add constraint item_logs_drill_ratings check (type = 'sets' or (technique is not null and effort is not null));

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  item_log_id uuid not null references public.item_logs (id) on delete cascade,
  set_no smallint not null check (set_no between 1 and 20),
  -- Zero is a failed attempt.
  reps smallint not null check (reps between 0 and 200),
  -- Null for bodyweight.
  load_kg numeric(5, 2) check (load_kg between 0 and 500),
  rpe smallint not null check (rpe between 1 and 10),
  logged_at timestamptz not null default now(),
  unique (item_log_id, set_no)
);

alter table public.set_logs enable row level security;
-- Through item_logs, whose policy goes through session_logs: one rule for the whole log.
create policy set_logs_select on public.set_logs for select to authenticated
  using (exists (select 1 from public.item_logs i where i.id = item_log_id));
grant select on public.set_logs to authenticated;

-- Saves one set of a scheduled exercise, opening the session and exercise logs on the first. Logging a set again
-- replaces it. Returns the session log.
create function public.log_set(session uuid, on_date date, item_position int, set_no int, reps int, load_kg numeric, rpe int)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  sched record;
  it public.session_items;
  log uuid;
  item_log uuid;
begin
  select * into sched from public.scheduled_session(session, on_date);
  if not found then
    raise exception 'not_scheduled' using errcode = '22023';
  end if;
  select * into it from public.session_items si where si.session_id = session and si.position = item_position;
  if it.id is null or it.type <> 'sets'
    or set_no is null or set_no not between 1 and 20
    or reps is null or reps not between 0 and 200
    or (load_kg is not null and (load_kg < 0 or load_kg > 500 or load_kg <> round(load_kg, 2)))
    or rpe is null or rpe not between 1 and 10 then
    raise exception 'bad_log' using errcode = '22023';
  end if;

  insert into public.session_logs (athlete_id, program_id, session_id, on_date, title, category_id)
  values (auth.uid(), sched.program_id, session, on_date, sched.title, sched.category_id)
  on conflict on constraint session_logs_athlete_id_session_id_on_date_key do update set title = excluded.title
  returning id into log;

  insert into public.item_logs (log_id, position, item_id, type)
  values (log, item_position, it.item_id, 'sets')
  on conflict on constraint item_logs_log_id_position_key do update set logged_at = now()
  returning id into item_log;

  insert into public.set_logs (item_log_id, set_no, reps, load_kg, rpe)
  values (item_log, set_no, reps, load_kg, rpe)
  on conflict on constraint set_logs_item_log_id_set_no_key do update
    set reps = excluded.reps, load_kg = excluded.load_kg, rpe = excluded.rpe, logged_at = now();
  return log;
end;
$$;

revoke execute on function public.log_set(uuid, date, int, int, int, numeric, int) from public, anon;
grant execute on function public.log_set(uuid, date, int, int, int, numeric, int) to authenticated;

-- export_my_data as in 20261121000000_session_logs.sql, with each exercise's sets.
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
        coalesce((select jsonb_agg(to_jsonb(i) - 'log_id' || jsonb_build_object('sets',
            coalesce((select jsonb_agg(to_jsonb(x) - 'item_log_id' order by x.set_no) from public.set_logs x where x.item_log_id = i.id), '[]'))
          order by i.position) from public.item_logs i where i.log_id = l.id), '[]'))
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
