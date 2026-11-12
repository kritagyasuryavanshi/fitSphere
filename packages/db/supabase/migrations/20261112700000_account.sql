-- M1-08: account (T-Account, T-ConfirmDelete): consent switches, data download, delete account.

-- A consent switch on the account page. It adds a row only when the answer or the notice changes,
-- and the newest row is the answer every reader uses, so turning a consent off takes effect at once.
create function public.set_my_consent(purpose public.consent_purpose, granted boolean, notice text)
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
  perform public.record_consent(uid, purpose, granted, notice);
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
    'coach_applications', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' - 'decided_by' order by x.created_at) from public.coach_applications x where x.user_id = uid), '[]')
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
  if public.is_admin() then
    raise exception 'admin_cannot_delete' using errcode = '22023';
  end if;
  select email into address from auth.users where id = uid;
  delete from public.email_outbox where to_email = address;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.set_my_consent(public.consent_purpose, boolean, text), public.export_my_data(), public.delete_my_account() from public, anon;
grant execute on function public.set_my_consent(public.consent_purpose, boolean, text), public.export_my_data(), public.delete_my_account() to authenticated;
