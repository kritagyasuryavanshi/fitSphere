-- M1-08: account (T-Account, T-ConfirmDelete): consent switches, data download, delete account.

-- Queued emails belong to a person, so deleting the account removes them even if the address changed since.
alter table public.email_outbox add column user_id uuid references public.profiles (id) on delete cascade;
create index email_outbox_user_idx on public.email_outbox (user_id);

-- The consent texts the app shows, by version. The server owns which version is current, so a consent row can only
-- name wording the app really showed, and an old yes never counts for new wording.
create table public.consent_notices (
  purpose public.consent_purpose not null,
  version text not null check (char_length(version) between 1 and 40),
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (purpose, version)
);
create unique index consent_notices_one_current on public.consent_notices (purpose) where is_current;
-- These match AI_NOTES_NOTICE and AI_METRICS_NOTICE in apps/web/src/app/welcome/options.ts.
insert into public.consent_notices (purpose, version, is_current) values
  ('ai_health_personalisation', 'ai-notes-2026-11-12', true),
  ('ai_body_metrics', 'ai-metrics-2026-11-12', true);
revoke all on public.consent_notices from anon, authenticated;
grant select on public.consent_notices to anon, authenticated;
grant all on public.consent_notices to service_role;
alter table public.consent_notices enable row level security;
create policy consent_notices_select_all on public.consent_notices for select to anon, authenticated using (true);

-- Same as in M1-04, plus: the notice must be one the server knows for that purpose.
create or replace function public.record_consent(uid uuid, what public.consent_purpose, answer boolean, notice text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  last record;
begin
  if answer is null then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.consent_notices where purpose = what and version = notice) then
    raise exception 'bad_notice' using errcode = '22023';
  end if;
  select granted, notice_version into last from public.consents
  where user_id = uid and purpose = what order by created_at desc limit 1;
  if not found or last.granted <> answer or last.notice_version <> notice then
    insert into public.consents (user_id, purpose, granted, notice_version) values (uid, what, answer, notice);
  end if;
end;
$$;

-- Same as in M1-07, but the queued email now carries the applicant's user id.
create or replace function public.decide_coach_application(application uuid, approve boolean)
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
    insert into public.email_outbox (user_id, to_email, template, data)
    values (app.user_id, email, case when approve then 'coach_approved' else 'coach_declined' end, jsonb_build_object('name', app.full_name));
  end if;
end;
$$;

-- A consent switch on the account page. It records the answer against the current notice (chosen here, not by the
-- caller), adds a row only when something changes, and the newest row is the answer, so off takes effect at once.
create function public.set_my_consent(purpose public.consent_purpose, granted boolean)
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
  perform public.record_consent(uid, purpose, granted,
    (select n.version from public.consent_notices n where n.purpose = set_my_consent.purpose and n.is_current));
end;
$$;

-- Everything personal we hold about the caller, as one JSON document (DPDP access request).
create function public.export_my_data()
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

-- Deletes the caller's account. Removing the auth user cascades to the profile and everything keyed to it:
-- roles, consents, sport answers, training basics, body metrics and coach applications. Queued emails go too.
-- The audit log keeps role events by id only, which hold nothing personal.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  address text;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  -- An admin must first lose the admin role (another admin removes it), so the app never runs out of admins.
  -- Same lock as role changes, so a grant of admin cannot slip in while this runs.
  perform 1 from public.user_roles where role = 'admin' for update;
  if public.is_admin() then
    raise exception 'admin_cannot_delete' using errcode = '22023';
  end if;
  select email into address from auth.users where id = uid;
  -- Proof the erasure happened, by id only.
  insert into public.audit_log (actor_id, action, target_id) values (uid, 'account_deleted', uid);
  delete from auth.users where id = uid;
  -- After the cascade, so an email queued by a decision that committed meanwhile is caught too.
  -- Rows with the user id went with the cascade; this catches older rows by address, in any letter case.
  delete from public.email_outbox where lower(to_email) = lower(address);
end;
$$;

revoke execute on function public.set_my_consent(public.consent_purpose, boolean), public.export_my_data(), public.delete_my_account() from public, anon;
grant execute on function public.set_my_consent(public.consent_purpose, boolean), public.export_my_data(), public.delete_my_account() to authenticated;
