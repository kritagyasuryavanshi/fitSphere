-- M4-08: messages between an athlete and a coach. One conversation per pair; only the two people in it read it.
-- A conversation can start only once there is an engagement between them (any state), so nobody messages cold.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.profiles (id) on delete set null,
  coach_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);
create unique index conversations_pair on public.conversations (athlete_id, coach_id);
create index conversations_coach_idx on public.conversations (coach_id);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, id);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations, public.messages from anon, authenticated;
grant select on public.conversations, public.messages to authenticated;
create policy conversations_select_party on public.conversations for select to authenticated
  using (athlete_id = (select auth.uid()) or coach_id = (select auth.uid()));
create policy messages_select_party on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id
    and (c.athlete_id = (select auth.uid()) or c.coach_id = (select auth.uid()))));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('coach_feedback', 'new_lesson', 'session_reminder', 'request_accepted', 'payment_due', 'new_request', 'request_declined',
    'request_withdrawn', 'new_message'));

-- The conversation for an engagement's two people, made on first use. Only those two can open it.
create function public.open_conversation(engagement uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  a uuid;
  c uuid;
  id_ uuid;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select g.athlete_id, g.coach_id into a, c from public.engagements g where g.id = engagement;
  if a is null or c is null or uid is distinct from a and uid is distinct from c then
    raise exception 'no_engagement' using errcode = '42501';
  end if;
  insert into public.conversations (athlete_id, coach_id) values (a, c) on conflict (athlete_id, coach_id) do nothing;
  select id into id_ from public.conversations where athlete_id = a and coach_id = c;
  return id_;
end;
$$;
revoke all on function public.open_conversation(uuid) from public;
grant execute on function public.open_conversation(uuid) to authenticated;

-- Sends a message. The other person gets at most one notification a day per conversation.
create function public.send_message(conversation uuid, body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cv public.conversations;
  other uuid;
  text_ text := btrim(coalesce(body, ''));
  id_ bigint;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select * into cv from public.conversations where id = conversation;
  if cv.id is null or uid is distinct from cv.athlete_id and uid is distinct from cv.coach_id then
    raise exception 'not_party' using errcode = '42501';
  end if;
  other := case when uid = cv.athlete_id then cv.coach_id else cv.athlete_id end;
  if other is null then
    raise exception 'closed' using errcode = '22023';
  end if;
  if char_length(text_) not between 1 and 2000 then
    raise exception 'bad_message' using errcode = '22023';
  end if;
  insert into public.messages (conversation_id, sender_id, body) values (conversation, uid, text_) returning id into id_;
  update public.conversations set last_message_at = now() where id = conversation;
  insert into public.notifications (user_id, kind, title, body, link, ref)
  values (other, 'new_message', 'New message',
    coalesce(nullif((select display_name from public.profiles where id = uid), ''), 'Someone') || ' sent you a message.',
    '/messages/' || conversation, conversation::text || ':' || public.india_today())
  on conflict do nothing;
  return id_;
end;
$$;
revoke all on function public.send_message(uuid, text) from public;
grant execute on function public.send_message(uuid, text) to authenticated;

-- The caller's conversations with the other person's name (profiles are private otherwise).
create function public.my_conversations()
returns table (conversation_id uuid, other_id uuid, other_name text, i_am_coach boolean, last_message_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, case when c.athlete_id = auth.uid() then c.coach_id else c.athlete_id end,
    coalesce(nullif(p.display_name, ''), case when c.athlete_id = auth.uid() then 'Coach' else 'Athlete' end),
    c.coach_id = auth.uid(), c.last_message_at
  from public.conversations c
  left join public.profiles p on p.id = case when c.athlete_id = auth.uid() then c.coach_id else c.athlete_id end
  where c.athlete_id = auth.uid() or c.coach_id = auth.uid()
  order by c.last_message_at desc nulls last, c.created_at desc;
$$;
revoke all on function public.my_conversations() from public;
grant execute on function public.my_conversations() to authenticated;

-- export_my_data as in 20261206000000_engagements.sql, plus the messages the person sent.
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
    'messages', coalesce((select jsonb_agg(jsonb_build_object('to', coalesce(nullif(p.display_name, ''), 'Someone'), 'body', m.body, 'at', m.created_at) order by m.id)
      from public.messages m join public.conversations c on c.id = m.conversation_id
      left join public.profiles p on p.id = case when c.athlete_id = uid then c.coach_id else c.athlete_id end
      where m.sender_id = uid), '[]'),
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
