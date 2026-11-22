-- M6-10: stage switches (decision-m6-launch). The beta opens with the marketplace closed: coaches can be browsed, but
-- nobody sends a hire request, accepts one, starts a conversation or sends a message. The guards sit on the tables,
-- so no path gets round them. One setting opens the marketplace for step 2. Production starts closed; the local seed
-- opens it, as it allows fake payments.

create table public.app_settings (
  id boolean primary key default true check (id),
  marketplace_open boolean not null default false
);
insert into public.app_settings (id, marketplace_open) values (true, false);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
grant all on public.app_settings to service_role;

-- Whether hiring and chat are open. Anyone may ask, so pages can say "opens soon".
create function public.marketplace_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select marketplace_open from public.app_settings), false);
$$;
revoke all on function public.marketplace_open() from public;
grant execute on function public.marketplace_open() to anon, authenticated, service_role;

-- Refuses a write the closed marketplace does not allow.
create function public.refuse_when_marketplace_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.marketplace_open() then
    raise exception 'marketplace_closed' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.refuse_when_marketplace_closed() from public, anon, authenticated;

-- New hire requests, conversations and messages.
create trigger engagements_marketplace_open before insert on public.engagements
  for each row execute function public.refuse_when_marketplace_closed();
create trigger conversations_marketplace_open before insert on public.conversations
  for each row execute function public.refuse_when_marketplace_closed();
create trigger messages_marketplace_open before insert on public.messages
  for each row execute function public.refuse_when_marketplace_closed();
-- A coach accepting a request. Declining, withdrawing and ending coaching still work.
create trigger engagements_accept_marketplace_open before update of status on public.engagements
  for each row when (old.status = 'requested' and new.status = 'accepted')
  execute function public.refuse_when_marketplace_closed();

-- conversation_open as in 20261207000000_messages.sql, closed while the marketplace is, so the chat says it cannot
-- send and send_message refuses with 'closed'.
create or replace function public.conversation_open(cv public.conversations)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select cv.athlete_id is not null and cv.coach_id is not null and public.marketplace_open()
    and exists (select 1 from public.engagements g where g.athlete_id = cv.athlete_id and g.coach_id = cv.coach_id
      and g.status not in ('declined', 'withdrawn', 'expired'))
    and not exists (select 1 from public.coach_profiles p where p.coach_id = cv.coach_id and p.status = 'suspended');
$$;

-- open_conversation as in 20261207000000_messages.sql, returning an existing conversation first: the insert guard
-- fires even on a conflict, and a closed marketplace still lets people read their history.
create or replace function public.open_conversation(engagement uuid)
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
  -- An existing conversation opens whatever the stage; only a new one needs the marketplace open.
  select id into id_ from public.conversations where athlete_id = a and coach_id = c;
  if id_ is not null then
    return id_;
  end if;
  insert into public.conversations (athlete_id, coach_id) values (a, c) on conflict (athlete_id, coach_id) do nothing;
  select id into id_ from public.conversations where athlete_id = a and coach_id = c;
  return id_;
end;
$$;
