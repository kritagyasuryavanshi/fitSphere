-- M4-19: money-safe account deletion, suspension and role loss (docs/plans/m4-plan.md, task 19).
-- Orders, payments and payouts stay when an account goes (their links are set null). An athlete cancels renewing
-- coaching before deleting, a coach cannot leave paying clients, and deletion by any path ends the coaching it leaves
-- behind, so stopSubscriptions cancels its subscription. A suspended coach, or one who loses the coach role, stops
-- every renewal: the paid month runs out, then the sweep ends the coaching.

-- Why the caller cannot delete their account, or null if they can. The app asks first, before it removes anything.
create function public.why_not_delete_my_account()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then 'signed_out'
    when public.is_admin() then 'admin'
    when exists (select 1 from public.engagements g join public.subscriptions s on s.engagement_id = g.id
      where g.athlete_id = auth.uid() and g.status = 'active' and s.status in ('active', 'pending')) then 'renewing'
    when exists (select 1 from public.engagements g
      where g.coach_id = auth.uid() and g.athlete_id is not null and g.status in ('active', 'cancelling')) then 'clients'
  end;
$$;
revoke all on function public.why_not_delete_my_account() from public, anon;
grant execute on function public.why_not_delete_my_account() to authenticated;

-- delete_my_account as in 20261112700000_account.sql, plus the money checks, under a lock on the caller's
-- engagements so a renewal or a new client cannot slip in while it runs.
create or replace function public.delete_my_account()
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
  perform 1 from public.engagements where athlete_id = uid or coach_id = uid for update;
  if public.why_not_delete_my_account() = 'renewing' then
    raise exception 'cancel_coaching_first' using errcode = '22023';
  end if;
  if public.why_not_delete_my_account() = 'clients' then
    raise exception 'coach_has_clients' using errcode = '22023';
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

-- close_requests_on_delete as in 20261206000000_engagements.sql, plus paid coaching: deleting an account by any path
-- ends the coaching it leaves (the subscription is then stopped by stopSubscriptions) and erases the athlete's cancel
-- reasons. The money records stay, with the person's link set null by the foreign keys.
create or replace function public.close_requests_on_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.engagements;
begin
  update public.engagements set status = 'withdrawn', ended_at = now() where athlete_id = old.id and status in ('requested', 'accepted');
  update public.engagements set status = 'declined', decided_at = now() where coach_id = old.id and status in ('requested', 'accepted');
  for g in select * from public.engagements where (athlete_id = old.id or coach_id = old.id) and status in ('active', 'cancelling') for update loop
    update public.engagements set status = 'ended', ended_at = now() where id = g.id returning * into g;
    -- The leaving person's own email goes with their account (email_outbox cascades); the other person's stays.
    perform public.queue_coaching_emails(g, 'coaching_ended');
  end loop;
  delete from public.cancel_reasons where engagement_id in (select id from public.engagements where athlete_id = old.id);
  return old;
end;
$$;

-- A coach who can no longer coach (suspended, or the coach role removed) stops every monthly renewal: the coaching
-- runs to the end of the month paid for, then the sweep ends it. Lifting a suspension does not restart charging.
create function public.stop_coach_renewals(coach uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.engagements;
begin
  for g in select * from public.engagements where coach_id = coach and status = 'active' and package_kind = 'monthly' for update loop
    update public.engagements set status = 'cancelling', cancel_at_period_end = true where id = g.id returning * into g;
    perform public.queue_coaching_emails(g, 'coaching_stopped');
  end loop;
end;
$$;

create function public.stop_renewals_on_suspend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.stop_coach_renewals(new.coach_id);
  return null;
end;
$$;
create trigger coach_profiles_stop_renewals after update of status on public.coach_profiles for each row
  when (new.status = 'suspended' and old.status is distinct from 'suspended')
  execute function public.stop_renewals_on_suspend();

create function public.stop_renewals_on_role_loss()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.stop_coach_renewals(old.user_id);
  return null;
end;
$$;
create trigger user_roles_stop_renewals after delete on public.user_roles for each row
  when (old.role = 'coach')
  execute function public.stop_renewals_on_role_loss();

revoke all on function public.stop_coach_renewals(uuid), public.stop_renewals_on_suspend(), public.stop_renewals_on_role_loss()
  from public, anon, authenticated;
