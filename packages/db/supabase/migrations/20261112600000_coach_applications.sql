-- M1-07: coach applications (P-ForCoaches, P-Applied, R-Roles) and an email outbox.

create type public.application_status as enum ('pending', 'approved', 'declined');

create table public.coach_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 80),
  category_id text not null references public.categories (id),
  city text not null check (char_length(city) between 1 and 80),
  -- Self-reported: nobody has checked it. Every screen that shows it says so.
  years_coaching smallint not null check (years_coaching between 0 and 60),
  work_url text not null default '' check (char_length(work_url) <= 300),
  how_today text not null default '' check (char_length(how_today) <= 1000),
  status public.application_status not null default 'pending',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
-- One open application per person.
create unique index coach_applications_one_pending on public.coach_applications (user_id) where status = 'pending';
create index coach_applications_decided_by_idx on public.coach_applications (decided_by);

-- Emails the app must send. Written in the same transaction as the event, so none is lost. A sender drains it
-- once the email provider account exists (O-02); until then rows wait with sent_at null.
create table public.email_outbox (
  id bigint generated always as identity primary key,
  to_email text not null,
  template text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default clock_timestamp(),
  sent_at timestamptz
);
create index email_outbox_unsent_idx on public.email_outbox (created_at) where sent_at is null;

create function public.submit_coach_application(full_name text, category text, city text, years int, work_url text, how_today text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_step1();
  name text := btrim(coalesce(full_name, ''));
  town text := btrim(coalesce(city, ''));
  link text := btrim(coalesce(work_url, ''));
begin
  if exists (select 1 from public.user_roles where user_id = uid and role = 'coach') then
    raise exception 'already_coach' using errcode = '22023';
  end if;
  if exists (select 1 from public.coach_applications where user_id = uid and status = 'pending') then
    raise exception 'already_applied' using errcode = '22023';
  end if;
  -- After a decline, wait 30 days, so one person cannot fill the admin queue (and the outbox) by reapplying.
  if exists (select 1 from public.coach_applications where user_id = uid and status = 'declined' and decided_at > now() - interval '30 days') then
    raise exception 'recently_declined' using errcode = '22023';
  end if;
  if char_length(name) not between 1 and 80 or char_length(town) not between 1 and 80 then
    raise exception 'name_and_city_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categories where id = category and is_live) then
    raise exception 'unknown_sport' using errcode = '22023';
  end if;
  if years is null or years not between 0 and 60 then
    raise exception 'bad_years' using errcode = '22023';
  end if;
  -- The admin opens this link, so only web links are kept.
  if link <> '' and (link !~* '^https?://[^\s]+$' or char_length(link) > 300) then
    raise exception 'bad_link' using errcode = '22023';
  end if;
  if char_length(coalesce(how_today, '')) > 1000 then
    raise exception 'too_long' using errcode = '22023';
  end if;
  insert into public.coach_applications (user_id, full_name, category_id, city, years_coaching, work_url, how_today)
  values (uid, name, category, town, years, link, btrim(coalesce(how_today, '')));
exception
  when unique_violation then
    raise exception 'already_applied' using errcode = '22023';
end;
$$;

-- An admin approves or declines. Approval grants the coach role through grant_role (admin check, self-block, audit).
-- Either way the applicant's email is queued in the same transaction.
create function public.decide_coach_application(application uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  app public.coach_applications;
  email text;
begin
  if not public.is_admin() then
    raise exception 'only an admin can decide' using errcode = '42501';
  end if;
  if approve is null then
    raise exception 'decision_required' using errcode = '22023';
  end if;
  select * into app from public.coach_applications where id = application for update;
  if not found then
    raise exception 'not_found' using errcode = '22023';
  end if;
  if app.status <> 'pending' then
    raise exception 'already_decided' using errcode = '22023';
  end if;
  -- Another admin decides an admin's own application. grant_role would refuse a self-grant too; this says so plainly.
  if app.user_id = auth.uid() then
    raise exception 'own_application' using errcode = '42501';
  end if;

  update public.coach_applications
  set status = case when approve then 'approved'::public.application_status else 'declined'::public.application_status end,
      decided_by = auth.uid(), decided_at = now()
  where id = application;
  if approve then
    perform public.grant_role(app.user_id, 'coach');
  end if;

  select u.email into email from auth.users u where u.id = app.user_id;
  -- A person without an email (for example a phone sign-in later) still gets the decision; there is just nobody to mail.
  if email is not null then
    insert into public.email_outbox (to_email, template, data)
    values (email, case when approve then 'coach_approved' else 'coach_declined' end, jsonb_build_object('name', app.full_name));
  end if;
end;
$$;

-- The pending list for admins, with the account email: full_name is free text, so the email shows who really applied.
create function public.admin_list_applications()
returns table (id uuid, user_id uuid, email text, full_name text, sport text, city text, years_coaching smallint, work_url text, how_today text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin can list applications' using errcode = '42501';
  end if;
  return query
    select a.id, a.user_id, u.email::text, a.full_name, c.name, a.city, a.years_coaching, a.work_url, a.how_today
    from public.coach_applications a
    join auth.users u on u.id = a.user_id
    join public.categories c on c.id = a.category_id
    where a.status = 'pending'
    order by a.created_at;
end;
$$;

revoke all on public.coach_applications, public.email_outbox from anon, authenticated;
revoke all on sequence public.email_outbox_id_seq from anon, authenticated;
grant all on public.coach_applications, public.email_outbox to service_role;
-- Applicants read their own rows, but not which admin decided.
grant select (id, user_id, full_name, category_id, city, years_coaching, work_url, how_today, status, decided_at, created_at) on public.coach_applications to authenticated;
revoke execute on function public.submit_coach_application(text, text, text, int, text, text), public.decide_coach_application(uuid, boolean), public.admin_list_applications() from public, anon;
grant execute on function public.submit_coach_application(text, text, text, int, text, text), public.decide_coach_application(uuid, boolean), public.admin_list_applications() to authenticated;

alter table public.coach_applications enable row level security;
alter table public.email_outbox enable row level security;
create policy coach_applications_select_own on public.coach_applications for select to authenticated using (user_id = (select auth.uid()));
create policy coach_applications_select_admin on public.coach_applications for select to authenticated using ((select public.is_admin()));
