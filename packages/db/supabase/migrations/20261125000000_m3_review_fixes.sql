-- Fixes from the M3 review (session 13).

-- 1. A coach reads a program's logs only while the athlete is active in THAT program. coach_can_read is true while
-- the athlete is in any of the coach's programs, so leaving one program kept its logs open to the coach.
create function public.coach_reads_program(athlete uuid, program uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('coach') and exists (
    select 1 from public.enrollments e join public.programs p on p.id = e.program_id
    where e.athlete_id = athlete and e.program_id = program and e.status = 'active' and p.coach_id = auth.uid()
  );
$$;
revoke execute on function public.coach_reads_program(uuid, uuid) from public, anon;
grant execute on function public.coach_reads_program(uuid, uuid) to authenticated;

drop policy session_logs_select_coach on public.session_logs;
create policy session_logs_select_coach on public.session_logs for select to authenticated
  using (public.coach_reads_program(athlete_id, program_id));

-- 2. Only the coach and people who joined (now or before) read a program's published versions, and through them its
-- sessions and drills. Guests and other users see a program only through its invite link (invite_info).
create function public.ever_enrolled(program uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.enrollments where program_id = program and athlete_id = auth.uid());
$$;
revoke execute on function public.ever_enrolled(uuid) from public, anon;
grant execute on function public.ever_enrolled(uuid) to authenticated;

drop policy program_versions_select_published on public.program_versions;
create policy program_versions_select_enrolled on public.program_versions for select to authenticated
  using (published_at is not null and public.ever_enrolled(program_id));

-- 3. A prescription holds only the numbers its type uses, so nothing else rides along into published versions.
create or replace function public.valid_prescription(t public.prescription_type, p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- A missing number makes the expression null; null counts as invalid, also in the check constraint.
  select coalesce(jsonb_typeof(p) = 'object' and case t
    when 'rounds' then (p->>'rounds') ~ '^\d{1,2}$' and (p->>'rounds')::int between 1 and 30
      and (p->>'work_s') ~ '^\d{1,4}$' and (p->>'work_s')::int between 10 and 3600
      and (p->>'rest_s') ~ '^\d{1,4}$' and (p->>'rest_s')::int between 0 and 1800
      and p - 'rounds' - 'work_s' - 'rest_s' = '{}'
    when 'time' then (p->>'seconds') ~ '^\d{1,5}$' and (p->>'seconds')::int between 10 and 14400
      and p - 'seconds' = '{}'
    when 'sets' then (p->>'sets') ~ '^\d{1,2}$' and (p->>'sets')::int between 1 and 20
      and (p->>'reps') ~ '^\d{1,3}$' and (p->>'reps')::int between 1 and 200
      and (p->'load_kg' is null or ((p->>'load_kg') ~ '^\d{1,3}(\.\d{1,2})?$' and (p->>'load_kg')::numeric <= 500))
      and p - 'sets' - 'reps' - 'load_kg' = '{}'
  end, false);
$$;

-- 4. A stable "newest" order for skill ratings: finish_session can move started_at earlier, so it is not a sort key.
alter table public.session_logs add column created_at timestamptz not null default now();
update public.session_logs set created_at = started_at;

create or replace function public.skill_ratings(athlete uuid)
returns table (item_id uuid, rating numeric, logs int)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.item_id, round(avg(r.technique), 1), count(*)::int
  from (
    select i.item_id, i.technique,
      row_number() over (partition by i.item_id order by l.on_date desc, l.created_at desc, i.position desc) as n
    from public.session_logs l
    join public.item_logs i on i.log_id = l.id
    where l.athlete_id = skill_ratings.athlete and i.technique is not null and i.item_id is not null
  ) r
  where r.n <= 5
  group by r.item_id;
$$;

-- 5. export_my_data as in 20261122000000_set_logs.sql, with the published title: programs.title is the coach's draft.
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
