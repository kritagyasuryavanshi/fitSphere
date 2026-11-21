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
    -- An accepted request counts: it can turn paid between this check and the delete.
    when exists (select 1 from public.engagements g
      where g.coach_id = auth.uid() and g.athlete_id is not null and g.status in ('accepted', 'active', 'cancelling')) then 'clients'
    -- Money still owed to the coach would have no one to go to once the account is gone.
    when exists (select 1 from public.payouts u where u.coach_id = auth.uid() and u.status in ('pending', 'on_hold', 'manual_due')) then 'payouts'
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
  if public.why_not_delete_my_account() = 'payouts' then
    raise exception 'payouts_due' using errcode = '22023';
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

-- close_requests_on_delete as in 20261206000000_engagements.sql, plus paid coaching. Deleting an account by any path
-- is refused for a coach with paying clients, ends the coaching an athlete leaves (stopSubscriptions then stops its
-- subscription), and erases the athlete's own words. The money records stay, with the person's link set null.
create or replace function public.close_requests_on_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.engagements;
begin
  -- Their clients have paid for days still to come: those must end first, whoever deletes the account.
  if exists (select 1 from public.engagements where coach_id = old.id and athlete_id is not null and status in ('active', 'cancelling')) then
    raise exception 'coach_has_clients' using errcode = '22023';
  end if;
  update public.engagements set status = 'withdrawn', ended_at = now() where athlete_id = old.id and status in ('requested', 'accepted');
  update public.engagements set status = 'declined', decided_at = now() where coach_id = old.id and status in ('requested', 'accepted');
  for g in select * from public.engagements where (athlete_id = old.id or coach_id = old.id) and status in ('active', 'cancelling') for update loop
    update public.engagements set status = 'ended', ended_at = now() where id = g.id returning * into g;
    -- The leaving person's own email goes with their account (email_outbox cascades); the other person's stays.
    perform public.queue_coaching_emails(g, 'coaching_ended');
    -- The other person's email keeps no name of the person who left; the template says "your client" instead.
    update public.email_outbox set data = data || '{"other": ""}' where template = 'coaching_ended' and data ->> 'engagement' = g.id::text and sent_at is null;
  end loop;
  -- Kept records keep no words of the athlete's own: their goals and cancel reasons go.
  update public.engagements set goals = '' where athlete_id = old.id and goals <> '';
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
  -- Requests waiting for a decision or a first payment close, so no new paid coaching starts with this coach.
  for g in select * from public.engagements where coach_id = coach and status in ('requested', 'accepted') for update loop
    update public.engagements set status = 'declined', decided_at = now() where id = g.id;
    if g.athlete_id is not null then
      insert into public.notifications (user_id, kind, title, body, link, ref)
      values (g.athlete_id, 'request_declined', 'Your request was declined', 'This coach cannot take on clients right now.', '/coaching', g.id::text)
      on conflict do nothing;
    end if;
  end loop;
  for g in select * from public.engagements where coach_id = coach and status = 'active' and package_kind = 'monthly' for update loop
    update public.engagements set status = 'cancelling', cancel_at_period_end = true where id = g.id returning * into g;
    -- A renewal already failing has no paid days left to promise; the sweep ends it.
    if g.paid_through >= public.india_today() then
      perform public.queue_coaching_emails(g, 'coaching_stopped');
    end if;
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

-- decide_request as in 20261206000000_engagements.sql, refusing an accept from a coach who is not live.
create or replace function public.decide_request(engagement uuid, accept boolean)
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
  -- Lock the request too: withdraw_request takes the same row lock, so a withdrawal and a decision take turns.
  select * into g from public.engagements where id = engagement for update;
  if g.status <> 'requested' then
    raise exception 'not_open' using errcode = '22023';
  end if;
  -- A suspended coach, or one off the marketplace, can still decline but takes on no one.
  if accept and not public.coach_is_live(uid) then
    raise exception 'not_live' using errcode = '22023';
  end if;
  if accept and public.coach_places_taken(uid) >= lim then
    raise exception 'coach_full' using errcode = '22023';
  end if;
  update public.engagements set status = case when accept then 'accepted' else 'declined' end, decided_at = now() where id = engagement and status = 'requested';
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
