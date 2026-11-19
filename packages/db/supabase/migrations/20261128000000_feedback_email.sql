-- M3-14: an email when a coach leaves feedback, with a switch to turn it off. give_feedback queues the email in
-- email_outbox in the same transaction as the note; the app's sender drains the outbox through the email provider.
-- M3-16 adds more switches to email_prefs.
create table public.email_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  coach_feedback boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.email_prefs enable row level security;
create policy email_prefs_select_own on public.email_prefs for select to authenticated using (user_id = (select auth.uid()));
grant select on public.email_prefs to authenticated;

-- The caller's switches, with the defaults when they never changed one.
create function public.my_email_prefs()
returns table (coach_feedback boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.coach_feedback from public.email_prefs p where p.user_id = auth.uid()), true);
$$;

create function public.set_email_pref(kind text, enabled boolean)
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
  if kind is distinct from 'coach_feedback' or enabled is null then
    raise exception 'bad_pref' using errcode = '22023';
  end if;
  insert into public.email_prefs (user_id, coach_feedback) values (uid, enabled)
  on conflict (user_id) do update set coach_feedback = excluded.coach_feedback, updated_at = now();
end;
$$;

revoke execute on function public.my_email_prefs(), public.set_email_pref(text, boolean) from public, anon;
grant execute on function public.my_email_prefs(), public.set_email_pref(text, boolean) to authenticated;

-- The sender claims a batch before sending, so two runs at once (the coach's action and the daily catch-up) never
-- send the same email. A claimed email that was not marked sent rests 10 minutes, so a failing email cannot block the
-- ones behind it, and it is given up after 5 tries. Only the server's secret key may claim.
alter table public.email_outbox add column claimed_at timestamptz, add column attempts smallint not null default 0;
create function public.claim_emails(templates text[], max_rows int default 50)
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
    order by x.created_at
    limit least(greatest(max_rows, 1), 200)
    for update skip locked
  )
  returning o.*;
$$;
revoke execute on function public.claim_emails(text[], int) from public, anon, authenticated;
grant execute on function public.claim_emails(text[], int) to service_role;

-- give_feedback as in 20261127000000_feedback.sql, plus the email.
create or replace function public.give_feedback(enrollment uuid, body text, log uuid default null)
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
  -- One email per note, unless the athlete turned feedback emails off; the sender drains email_outbox.
  if coalesce((select p.coach_feedback from public.email_prefs p where p.user_id = e.athlete_id), true) then
    insert into public.email_outbox (user_id, to_email, template, data)
    select e.athlete_id, u.email, 'coach_feedback',
      jsonb_build_object('coach', f.coach_name, 'program', f.program_title, 'excerpt', left(f.body, 300), 'feedback', f.id)
    from auth.users u, public.feedback f
    where u.id = e.athlete_id and u.email is not null and f.id = id_;
  end if;
  return id_;
end;
$$;

-- export_my_data as in 20261127000000_feedback.sql, plus the email switches.
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
