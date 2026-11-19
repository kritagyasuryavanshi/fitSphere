-- M4-07: hiring a coach. One engagements table carries the whole state machine (docs/plans/m4-plan.md):
-- requested -> accepted (awaiting payment) -> active -> cancelling -> ended, with the side exits declined, withdrawn,
-- expired, lapsed and refunded. This task writes requested, accepted, declined and withdrawn; payments (M4-09 on) the rest.

-- The platform fee in basis points, copied onto each engagement and order so a later change never alters them.
-- shortcut: the plan's default of 15% until the owner confirms the fee (owner item O-05); change it here only.
create function public.platform_fee_bps()
returns smallint
language sql
immutable
set search_path = ''
as $$
  select 1500::smallint;
$$;
revoke all on function public.platform_fee_bps() from public;
grant execute on function public.platform_fee_bps() to anon, authenticated;

create table public.engagements (
  id uuid primary key default gen_random_uuid(),
  -- Set null, not cascade, so money records stay when an account goes (M4-19 decides the rest).
  athlete_id uuid references public.profiles (id) on delete set null,
  coach_id uuid references public.coach_profiles (coach_id) on delete set null,
  package_id uuid references public.packages (id) on delete set null,
  -- What was asked for, as it was then: a later price or title change does not touch it.
  package_title text not null check (char_length(package_title) between 1 and 80),
  package_kind text not null check (package_kind in ('monthly', 'single')),
  price_paise bigint not null check (price_paise between 1 and 100000000),
  fee_bps smallint not null check (fee_bps between 0 and 10000),
  start_date date not null,
  days_per_week smallint not null check (days_per_week between 1 and 7),
  goals text not null default '' check (char_length(goals) <= 1000),
  -- The athlete's choice to share training logs and sign-up answers while a client (used from M4-10).
  share_data boolean not null default false,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'active', 'cancelling', 'ended', 'declined', 'withdrawn', 'expired', 'lapsed', 'refunded')),
  paid_through date,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  ended_at timestamptz
);
-- One open engagement per athlete and coach.
create unique index engagements_one_open on public.engagements (athlete_id, coach_id) where status in ('requested', 'accepted', 'active', 'cancelling');
create index engagements_coach_idx on public.engagements (coach_id, status);
create index engagements_athlete_idx on public.engagements (athlete_id, status);

alter table public.engagements enable row level security;
revoke all on public.engagements from anon, authenticated;
grant select on public.engagements to authenticated;
create policy engagements_select_party on public.engagements for select to authenticated
  using (athlete_id = (select auth.uid()) or coach_id = (select auth.uid()));

-- A coach's places taken: accepted requests hold a place while awaiting payment.
create function public.coach_places_taken(coach uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.engagements where coach_id = coach and status in ('accepted', 'active', 'cancelling');
$$;
revoke all on function public.coach_places_taken(uuid) from public, anon, authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('coach_feedback', 'new_lesson', 'session_reminder', 'request_accepted', 'payment_due', 'new_request', 'request_declined'));

-- An athlete asks a live coach for a live package. Requests pause while the coach is at the client limit.
create function public.request_coaching(package uuid, start date, days smallint, goals text, share boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  k public.packages;
  lim smallint;
  id_ uuid;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not public.has_role('athlete') then
    raise exception 'not_athlete' using errcode = '42501';
  end if;
  select * into k from public.packages where id = package;
  if k.id is null or not k.live or not public.coach_is_live(k.coach_id) then
    raise exception 'not_available' using errcode = '22023';
  end if;
  if k.coach_id = uid then
    raise exception 'own_profile' using errcode = '22023';
  end if;
  if start is null or start < public.india_today() or start > public.india_today() + 60 or days is null or days not between 1 and 7
     or share is null or char_length(coalesce(goals, '')) > 1000 then
    raise exception 'bad_request' using errcode = '22023';
  end if;
  -- The coach's row lock makes requests and accepts for one coach take turns, so the limit holds.
  select client_limit into lim from public.coach_profiles where coach_id = k.coach_id for update;
  if public.coach_places_taken(k.coach_id) >= lim then
    raise exception 'coach_full' using errcode = '22023';
  end if;
  if exists (select 1 from public.engagements where athlete_id = uid and coach_id = k.coach_id and status in ('requested', 'accepted', 'active', 'cancelling')) then
    raise exception 'already_open' using errcode = '22023';
  end if;
  insert into public.engagements (athlete_id, coach_id, package_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, goals, share_data)
  values (uid, k.coach_id, k.id, k.title, k.kind, k.price_paise, public.platform_fee_bps(), start, days, btrim(coalesce(goals, '')), share)
  returning id into id_;
  insert into public.notifications (user_id, kind, title, body, link, ref)
  values (k.coach_id, 'new_request', 'New coaching request',
    coalesce(nullif((select display_name from public.profiles where id = uid), ''), 'An athlete') || ' asked for ' || k.title || '.', '/coach/clients', id_::text)
  on conflict do nothing;
  return id_;
end;
$$;
revoke all on function public.request_coaching(uuid, date, smallint, text, boolean) from public;
grant execute on function public.request_coaching(uuid, date, smallint, text, boolean) to authenticated;

-- The coach accepts (the athlete can then pay) or declines. An accept needs a free place.
create function public.decide_request(engagement uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g public.engagements;
  lim smallint;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if accept is null then
    raise exception 'bad_input' using errcode = '22023';
  end if;
  select * into g from public.engagements where id = engagement;
  if g.id is null or g.coach_id is distinct from uid or not public.has_role('coach') then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  select client_limit into lim from public.coach_profiles where coach_id = uid for update;
  -- Read again under the lock: a withdraw or another decision may have come first.
  select * into g from public.engagements where id = engagement;
  if g.status <> 'requested' then
    raise exception 'not_open' using errcode = '22023';
  end if;
  if accept and public.coach_places_taken(uid) >= lim then
    raise exception 'coach_full' using errcode = '22023';
  end if;
  update public.engagements set status = case when accept then 'accepted' else 'declined' end, decided_at = now() where id = engagement;
  if g.athlete_id is not null then
    insert into public.notifications (user_id, kind, title, body, link, ref)
    values (g.athlete_id, case when accept then 'request_accepted' else 'request_declined' end,
      case when accept then 'Your coach accepted' else 'Your request was declined' end,
      coalesce(nullif((select display_name from public.profiles where id = uid), ''), 'The coach')
        || case when accept then ' accepted your request for ' || g.package_title || '. Pay to start.' else ' cannot take you on right now.' end,
      '/coaching', engagement::text)
    on conflict do nothing;
  end if;
end;
$$;
revoke all on function public.decide_request(uuid, boolean) from public;
grant execute on function public.decide_request(uuid, boolean) to authenticated;

-- The athlete withdraws a request before paying.
create function public.withdraw_request(engagement uuid)
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
  update public.engagements set status = 'withdrawn', ended_at = now()
  where id = engagement and athlete_id = uid and status in ('requested', 'accepted');
  if not found then
    raise exception 'not_open' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.withdraw_request(uuid) from public;
grant execute on function public.withdraw_request(uuid) to authenticated;

-- Whether a live coach has a free place, for the profile and hire pages (the count itself stays private).
create function public.coach_has_room(coach uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.coach_is_live(coach)
    and public.coach_places_taken(coach) < (select client_limit from public.coach_profiles where coach_id = coach);
$$;
revoke all on function public.coach_has_room(uuid) from public;
grant execute on function public.coach_has_room(uuid) to anon, authenticated;

-- The calling coach's open requests and clients, with each athlete's name (profiles are private otherwise).
create function public.coach_requests()
returns table (engagement_id uuid, athlete_name text, package_title text, package_kind text, price_paise bigint, start_date date,
  days_per_week smallint, goals text, share_data boolean, status text, created_at timestamptz, paid_through date, cancel_at_period_end boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, coalesce(nullif(p.display_name, ''), 'Athlete'), g.package_title, g.package_kind, g.price_paise, g.start_date,
    g.days_per_week, g.goals, g.share_data, g.status, g.created_at, g.paid_through, g.cancel_at_period_end
  from public.engagements g
  left join public.profiles p on p.id = g.athlete_id
  where g.coach_id = auth.uid() and public.has_role('coach') and g.status in ('requested', 'accepted', 'active', 'cancelling')
  order by g.created_at desc;
$$;
revoke all on function public.coach_requests() from public;
grant execute on function public.coach_requests() to authenticated;

-- export_my_data as in 20261205000000_shortlists.sql, plus the athlete's coaching requests.
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
