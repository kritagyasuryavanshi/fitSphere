-- M4-15: client stories with written consent (docs/plans/remaining-tasks-plan.md). The coach of paid coaching drafts a
-- story; each edit is a new, unchangeable revision. It shows in public only after the client approves that exact
-- revision; photos need a second, separate approval of the same revision. The client can withdraw at any time and
-- the story disappears at once. Unapproved revisions and withdrawn stories are pruned after 30 days.
begin;
select plan(24);

insert into auth.users (id, email, email_confirmed_at) values
  ('5c000000-0000-0000-0000-0000000000c1', 'st-coach@t.test', now()),
  ('5c000000-0000-0000-0000-0000000000c2', 'st-other@t.test', now()),
  ('5c000000-0000-0000-0000-0000000000a1', 'st-athlete@t.test', now()),
  ('5c000000-0000-0000-0000-0000000000a2', 'st-unpaid@t.test', now());
insert into public.user_roles (user_id, role) values ('5c000000-0000-0000-0000-0000000000c1', 'coach'), ('5c000000-0000-0000-0000-0000000000c2', 'coach');
update public.profiles set display_name = 'Kabir Singh' where id = '5c000000-0000-0000-0000-0000000000a1';
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('5c000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement());
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data, paid_through) values
  ('5d000000-0000-0000-0000-0000000000e1', '5c000000-0000-0000-0000-0000000000a1', '5c000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 40, 3, 'ended', true, public.india_today() - 10),
  ('5d000000-0000-0000-0000-0000000000e2', '5c000000-0000-0000-0000-0000000000a2', '5c000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today(), 3, 'accepted', true, null);
insert into public.orders (id, engagement_id, amount_paise, fee_bps, kind, period_start, period_end, provider_order_id, status, paid_at) values
  ('5e000000-0000-0000-0000-000000000001', '5d000000-0000-0000-0000-0000000000e1', 450000, 1500, 'first', public.india_today() - 40, public.india_today() - 10, 'order_st1', 'paid', now() - interval '40 days');

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temp table s (id uuid);
grant all on s to authenticated;
set local role authenticated;

-- Drafting: only the coach of paid coaching.
select pg_temp.as_user('5c000000-0000-0000-0000-0000000000c2');
select throws_ok($$ select public.save_story('5d000000-0000-0000-0000-0000000000e1', 'Kabir went from no guard to a sharp jab in six weeks of steady work.', '{}') $$, '42501', 'not_your_client', 'another coach cannot write it');
select pg_temp.as_user('5c000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.save_story('5d000000-0000-0000-0000-0000000000e2', 'Twenty characters at least, about training together.', '{}') $$, '22023', 'not_paid', 'coaching that was never paid has no story');
select throws_ok($$ select public.save_story('5d000000-0000-0000-0000-0000000000e1', 'Too short', '{}') $$, '22023', 'bad_story', 'a story needs 20 to 2,000 characters');
select throws_ok($$ select public.save_story('5d000000-0000-0000-0000-0000000000e1', 'Kabir went from no guard to a sharp jab in six weeks.', array['elsewhere/x.jpg']) $$, '22023', 'bad_photo', 'photos must sit in the story folder, named by their hash');
insert into s select public.save_story('5d000000-0000-0000-0000-0000000000e1', 'Kabir went from no guard to a sharp jab in six weeks of steady work.',
  array['stories/5d000000-0000-0000-0000-0000000000e1/' || repeat('a', 64) || '.jpg']);
select is((select current_rev from public.stories where id = (select id from s)), 1, 'the first draft is revision 1');
select is_empty($$ select * from public.public_stories('5c000000-0000-0000-0000-0000000000c1') $$, 'a draft is not public');

-- The client approves the exact revision.
select pg_temp.as_user('5c000000-0000-0000-0000-0000000000c2');
select throws_ok($$ select public.approve_story((select id from s), 1) $$, '42501', 'not_yours', 'only the client approves');
select pg_temp.as_user('5c000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.approve_story((select id from s), 2) $$, '22023', 'stale_revision', 'a revision that is not the current one cannot be approved');
select lives_ok($$ select public.approve_story((select id from s), 1) $$, 'the client approves revision 1');
select is((select body || '|' || author || '|' || photo_count from public.public_stories('5c000000-0000-0000-0000-0000000000c1')),
  'Kabir went from no guard to a sharp jab in six weeks of steady work.|Kabir S.|0', 'it is public, by first name and last initial, without photos');
select throws_ok($$ select public.approve_story_photos((select id from s), 2) $$, '22023', 'stale_revision', 'photo approval names the approved revision');
select lives_ok($$ select public.approve_story_photos((select id from s), 1) $$, 'the client approves the photos separately');
select is((select photo_count from public.public_stories('5c000000-0000-0000-0000-0000000000c1')), 1, 'now the photo shows');

-- An edit is a new revision: the approved text stays public, the new one waits for approval.
select pg_temp.as_user('5c000000-0000-0000-0000-0000000000c1');
select lives_ok($$ select public.save_story('5d000000-0000-0000-0000-0000000000e1', 'Kabir went from no guard to a sharp, fast jab in six weeks.', '{}') $$, 'the coach edits');
select is((select current_rev || '|' || approved_rev from public.stories where id = (select id from s)), '2|1', 'revision 2 waits; revision 1 stays approved');
select is((select body from public.public_stories('5c000000-0000-0000-0000-0000000000c1')), 'Kabir went from no guard to a sharp jab in six weeks of steady work.', 'the public sees only what the client approved');
select throws_ok($$ update public.story_revisions set body = 'changed' $$, '42501', null, 'nobody rewrites a revision');

select is(jsonb_array_length((public.export_my_data()) -> 'stories'), 1, 'the coach finds the story, with its revisions, in their data download');

-- Withdrawal hides it at once.
select pg_temp.as_user('5c000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.withdraw_story((select id from s)) $$, 'the client withdraws');
select is_empty($$ select * from public.public_stories('5c000000-0000-0000-0000-0000000000c1') $$, 'the story disappears');

-- Retention (service role, daily cron): withdrawn 31 days ago goes, with its photo keys returned for deletion.
reset role;
update public.stories set withdrawn_at = now() - interval '31 days' where id = (select id from s);
select is((select count(*)::int from public.prune_stories()), 1, 'the pruned photo key comes back for the storage clean-up');
select is_empty($$ select 1 from public.stories where id = (select id from s) $$, 'the withdrawn story is gone after 30 days');
select is_empty($$ select 1 from public.story_revisions where story_id = (select id from s) $$, 'with every revision');
-- A file no revision uses (a failed save, or a deleted account's story) is found after a day.
insert into storage.objects (bucket_id, name, created_at) values ('story-photos', 'stories/5d000000-0000-0000-0000-0000000000e1/' || repeat('b', 64) || '.jpg', now() - interval '2 days');
select ok((select bool_or(photo_key like '%' || repeat('b', 64) || '.jpg') from public.prune_stories()), 'an orphaned upload is returned for deletion');

select * from finish();
rollback;
