-- M4-03: credential checks (X-Verify). A coach records the issuer and an optional ID number with each document; an
-- admin checks it against the issuer and marks it checked or rejects it with a note the coach sees. Every decision is
-- logged with the admin and the date. The public badge reads public_credentials, which lists checked ones only.

alter table public.credentials
  add column issuer text not null default '' check (char_length(issuer) <= 120),
  -- The certificate or membership number, for the admin's lookup with the issuer. Never public.
  add column id_number text not null default '' check (char_length(id_number) <= 60);

-- submit_credential as in 20261130000000_marketplace_profiles.sql, plus the issuer and ID number.
drop function public.submit_credential(text, text);
create function public.submit_credential(title text, file_path text, issuer text default '', id_number text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  id_ uuid;
begin
  if uid is null or not public.has_role('coach') or not exists (select 1 from public.coach_profiles where coach_id = uid) then
    raise exception 'not_coach' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(title, ''))) not between 1 and 120 or char_length(btrim(coalesce(issuer, ''))) > 120
    or char_length(btrim(coalesce(id_number, ''))) > 60 then
    raise exception 'bad_credential' using errcode = '22023';
  end if;
  -- Own folder, one plain file name: no "..", no sub-folders, no other coach's folder.
  if coalesce(file_path, '') !~ ('^' || uid::text || '/[A-Za-z0-9._-]{1,120}$') or file_path like '%..%' then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'credentials' and o.name = file_path) then
    raise exception 'no_file' using errcode = '22023';
  end if;
  insert into public.credentials (coach_id, title, file_path, issuer, id_number)
  values (uid, btrim(title), file_path, btrim(coalesce(issuer, '')), btrim(coalesce(id_number, ''))) returning id into id_;
  return id_;
end;
$$;

-- The admin's decision on one pending credential. A reject needs a note; the decision is logged.
create function public.decide_credential(credential uuid, approve boolean, note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c public.credentials;
  body text := btrim(coalesce(note, ''));
begin
  if uid is null or not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if approve is null or char_length(body) > 500 then
    raise exception 'bad_decision' using errcode = '22023';
  end if;
  if not approve and body = '' then
    raise exception 'note_required' using errcode = '22023';
  end if;
  select * into c from public.credentials where id = credential for update;
  if c.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if c.status <> 'pending' then
    raise exception 'already_decided' using errcode = '22023';
  end if;
  update public.credentials set status = case when approve then 'checked' else 'rejected' end, note = body, decided_by = uid, decided_at = now()
  where id = credential;
  insert into public.audit_log (actor_id, action, target_id, details)
  values (uid, case when approve then 'credential_checked' else 'credential_rejected' end, c.coach_id,
    jsonb_build_object('credential', c.id, 'title', c.title));
end;
$$;

-- The admin queue: pending credentials, oldest first, with the coach's name.
create function public.admin_pending_credentials()
returns table (id uuid, coach_id uuid, coach_name text, title text, issuer text, id_number text, file_path text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query
    select c.id, c.coach_id, coalesce(nullif(p.display_name, ''), nullif(cp.headline, ''), 'Coach'), c.title, c.issuer, c.id_number, c.file_path, c.created_at
    from public.credentials c
    join public.coach_profiles cp on cp.coach_id = c.coach_id
    left join public.profiles p on p.id = c.coach_id
    where c.status = 'pending'
    order by c.created_at;
end;
$$;

revoke execute on function public.submit_credential(text, text, text, text), public.decide_credential(uuid, boolean, text), public.admin_pending_credentials() from public, anon;
grant execute on function public.submit_credential(text, text, text, text), public.decide_credential(uuid, boolean, text), public.admin_pending_credentials() to authenticated;

-- The public view gains the issuer (the ID number stays private).
create or replace view public.public_credentials with (security_invoker = false) as
  select c.id, c.coach_id, c.title, c.decided_at, c.issuer
  from public.credentials c
  where c.status = 'checked' and public.coach_is_live(c.coach_id);
revoke all on public.public_credentials from anon, authenticated;
grant select on public.public_credentials to anon, authenticated;
