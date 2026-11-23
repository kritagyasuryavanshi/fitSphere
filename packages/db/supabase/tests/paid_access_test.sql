-- M4-10: a paid engagement opens coach access like an enrollment, but only with the athlete's sharing choice, and
-- closes when the coaching ends or is refunded. The coach assigns a program to a paying client; that enrollment ends
-- with the coaching. coach_stats counts paid clients.
begin;
select plan(32);

-- Coach Vikram (live) and coach Ananya. Kabir pays and shares; Neha pays and does not share; Ravi is accepted but has
-- not paid; Isha is cancelling (still paid to the end of the month) and shares.
insert into auth.users (id, email, email_confirmed_at) values
  ('e1000000-0000-0000-0000-0000000000c1', 'pa-vikram@t.test', now()),
  ('e1000000-0000-0000-0000-0000000000c2', 'pa-ananya@t.test', now()),
  ('e1000000-0000-0000-0000-0000000000a1', 'pa-kabir@t.test', now()),
  ('e1000000-0000-0000-0000-0000000000a2', 'pa-neha@t.test', now()),
  ('e1000000-0000-0000-0000-0000000000a3', 'pa-ravi@t.test', now()),
  ('e1000000-0000-0000-0000-0000000000a4', 'pa-isha@t.test', now()),
  ('e1000000-0000-0000-0000-0000000000a5', 'pa-arjun@t.test', now());
insert into public.user_roles (user_id, role) values
  ('e1000000-0000-0000-0000-0000000000c1', 'coach'), ('e1000000-0000-0000-0000-0000000000c2', 'coach');
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('e1000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement()),
  ('e1000000-0000-0000-0000-0000000000c2', 'Gym', 'live', public.current_coach_agreement());
insert into public.athlete_basics (user_id, days_per_week, injury_notes) values
  ('e1000000-0000-0000-0000-0000000000a1', 3, 'old left knee'), ('e1000000-0000-0000-0000-0000000000a2', 3, 'shoulder'),
  ('e1000000-0000-0000-0000-0000000000a3', 3, ''), ('e1000000-0000-0000-0000-0000000000a4', 3, ''), ('e1000000-0000-0000-0000-0000000000a5', 3, 'ankle');
-- Kabir's body weight: paid coaching does not open it (the hire form names logs and sign-up answers only).
insert into public.body_metrics (user_id, weight_kg) values ('e1000000-0000-0000-0000-0000000000a1', 72.5);
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data, paid_through) values
  ('e2000000-0000-0000-0000-0000000000e1', 'e1000000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 5, 3, 'active', true, public.india_today() + 25),
  ('e2000000-0000-0000-0000-0000000000e2', 'e1000000-0000-0000-0000-0000000000a2', 'e1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 5, 3, 'active', false, public.india_today() + 25),
  ('e2000000-0000-0000-0000-0000000000e3', 'e1000000-0000-0000-0000-0000000000a3', 'e1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today(), 3, 'accepted', true, null),
  ('e2000000-0000-0000-0000-0000000000e4', 'e1000000-0000-0000-0000-0000000000a4', 'e1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 20, 3, 'cancelling', true, public.india_today() + 10),
  -- Arjun's paid month ran out yesterday, and nothing has changed the status yet (the M4-11 sweep runs late).
  ('e2000000-0000-0000-0000-0000000000e5', 'e1000000-0000-0000-0000-0000000000a5', 'e1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 34, 3, 'active', true, public.india_today() - 4);

create temp table ids (name text primary key, v uuid);
grant all on ids to authenticated;
set local role authenticated;

-- Vikram's published program, and Ananya's.
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into ids select 'pv', public.create_program('Boxing Fundamentals', 'boxing');
select public.save_program_draft((select v from ids where name = 'pv'), 'Boxing Fundamentals', '', 6,
  jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'title', 'Jab', 'items', '[]'::jsonb)));
select public.publish_program((select v from ids where name = 'pv'));
insert into ids select 'draft', public.create_program('Unfinished', 'boxing');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
insert into ids select 'pa', public.create_program('Muscle Builder', 'gym');
select public.save_program_draft((select v from ids where name = 'pa'), 'Muscle Builder', '', 4,
  jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'title', 'Push', 'items', '[]'::jsonb)));
select public.publish_program((select v from ids where name = 'pa'));

-- Access through the engagement alone, before any program is assigned.
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select ok(public.coach_can_read('e1000000-0000-0000-0000-0000000000a1'), 'a paying client who shares opens their data to the coach');
select is((select injury_notes from public.athlete_basics where user_id = 'e1000000-0000-0000-0000-0000000000a1'), 'old left knee',
  'so the coach reads their sign-up answers');
select ok(not public.coach_can_read('e1000000-0000-0000-0000-0000000000a2'), 'a paying client who does not share stays closed');
select is((select count(*)::int from public.athlete_basics where user_id = 'e1000000-0000-0000-0000-0000000000a2'), 0,
  'so the coach reads none of their answers');
select ok(not public.coach_can_read('e1000000-0000-0000-0000-0000000000a3'), 'an accepted request that is not paid opens nothing');
select ok(public.coach_can_read('e1000000-0000-0000-0000-0000000000a4'), 'a client who is cancelling stays open to the end of the paid month');
select ok(not public.coach_can_read('e1000000-0000-0000-0000-0000000000a5'), 'access closes when the paid period and its 3-day grace end, whatever the status says');
select is((select count(*)::int from public.body_metrics where user_id = 'e1000000-0000-0000-0000-0000000000a1'), 0,
  'paid coaching does not open body weight');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select ok(not public.coach_can_read('e1000000-0000-0000-0000-0000000000a1'), 'another coach reads nothing');

-- The coach assigns a program to a paying client.
select throws_ok($$ select public.assign_program('e2000000-0000-0000-0000-0000000000e1', (select v from ids where name = 'pa')) $$, '42501', 'not_yours',
  'another coach cannot assign to someone else''s client');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$ select public.assign_program('e2000000-0000-0000-0000-0000000000e1', (select v from ids where name = 'pa')) $$, '42501', 'not_owner',
  'nor a program the coach does not own');
select throws_ok($$ select public.assign_program('e2000000-0000-0000-0000-0000000000e1', (select v from ids where name = 'draft')) $$, '22023', 'not_published',
  'nor an unpublished program');
select throws_ok($$ select public.assign_program('e2000000-0000-0000-0000-0000000000e3', (select v from ids where name = 'pv')) $$, '22023', 'not_active',
  'nor to a client who has not paid');
select throws_ok($$ select public.assign_program('e2000000-0000-0000-0000-0000000000e5', (select v from ids where name = 'pv')) $$, '22023', 'not_active',
  'nor to a client whose paid period has ended');
insert into ids select 'ek', enrollment_id from public.assign_program('e2000000-0000-0000-0000-0000000000e1', (select v from ids where name = 'pv'));
select is((select row(athlete_id, status::text, engagement_id, start_date)::text from public.enrollments where id = (select v from ids where name = 'ek')),
  row('e1000000-0000-0000-0000-0000000000a1'::uuid, 'active', 'e2000000-0000-0000-0000-0000000000e1'::uuid, public.india_today())::text,
  'assigning enrolls the client from today, tied to the engagement');
select is((select row(enrollment_id, created)::text from public.assign_program('e2000000-0000-0000-0000-0000000000e1', (select v from ids where name = 'pv'))),
  row((select v from ids where name = 'ek'), false)::text, 'assigning again returns the same enrollment, and says nothing was created');
select ok(public.coach_reads_program('e1000000-0000-0000-0000-0000000000a1', (select v from ids where name = 'pv')),
  'the coach reads the client''s logs in the assigned program');
insert into ids select 'en', enrollment_id from public.assign_program('e2000000-0000-0000-0000-0000000000e2', (select v from ids where name = 'pv'));
select ok(not public.coach_reads_program('e1000000-0000-0000-0000-0000000000a2', (select v from ids where name = 'pv'))
  and not public.coach_can_read('e1000000-0000-0000-0000-0000000000a2'),
  'an assigned program does not open the logs of a client who does not share');
select throws_ok($$ select public.give_feedback((select v from ids where name = 'en'), 'Good work') $$, '42501', 'not_allowed',
  'nor lets the coach give feedback on them');
insert into ids select 'ei', enrollment_id from public.assign_program('e2000000-0000-0000-0000-0000000000e4', (select v from ids where name = 'pv'));

-- Isha leaves the assigned program; the coach cannot push it back on her.
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
select lives_ok($$ select public.leave_program((select v from ids where name = 'ei')) $$, 'the client can leave an assigned program');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$ select public.assign_program('e2000000-0000-0000-0000-0000000000e4', (select v from ids where name = 'pv')) $$, '22023', 'left_program',
  'and the coach cannot assign it to her again');

-- The client sees the assigned program, and cannot assign one themselves.
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select title from public.my_programs()), 'Boxing Fundamentals', 'the client sees the assigned program in My programs');
select throws_ok($$ select public.assign_program('e2000000-0000-0000-0000-0000000000e1', (select v from ids where name = 'pv')) $$, '42501', 'not_yours',
  'the client cannot assign programs');

-- A suspended coach cannot assign.
reset role;
update public.coach_profiles set status = 'suspended' where coach_id = 'e1000000-0000-0000-0000-0000000000c1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$ select public.assign_program('e2000000-0000-0000-0000-0000000000e1', (select v from ids where name = 'pv')) $$, '42501', 'not_live',
  'a suspended coach cannot assign programs');
reset role;
update public.coach_profiles set status = 'live' where coach_id = 'e1000000-0000-0000-0000-0000000000c1';

-- coach_stats counts paid clients (Kabir, Neha, Isha, Arjun), not the unpaid request (Ravi).
select is((select athletes from public.coach_stats('e1000000-0000-0000-0000-0000000000c1')), 4, 'paid coaching clients count as athletes');
update public.engagements set status = 'refunded', ended_at = now() where id = 'e2000000-0000-0000-0000-0000000000e2';
select is((select athletes from public.coach_stats('e1000000-0000-0000-0000-0000000000c1')), 3, 'a refunded client does not count');

-- The coaching ends: the assigned program ends with it, and the coach's access closes.
update public.engagements set status = 'ended', ended_at = now() where id = 'e2000000-0000-0000-0000-0000000000e1';
select is((select status::text from public.enrollments where id = (select v from ids where name = 'ek')), 'ended', 'the assigned program ends with the coaching');
select is((select status::text from public.enrollments where id = (select v from ids where name = 'en')), 'ended', 'and with a refund');
update public.engagements set status = 'lapsed', ended_at = now() where id = 'e2000000-0000-0000-0000-0000000000e4';
select is((select status::text from public.enrollments where id = (select v from ids where name = 'ei')), 'left',
  'a lapse leaves an enrollment the client already left as it was');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select ok(not public.coach_can_read('e1000000-0000-0000-0000-0000000000a1'), 'the coach''s access closes when the coaching ends');
select ok(not public.coach_reads_program('e1000000-0000-0000-0000-0000000000a1', (select v from ids where name = 'pv')), 'logs included');
select throws_ok($$ select public.assign_program('e2000000-0000-0000-0000-0000000000e1', (select v from ids where name = 'pv')) $$, '22023', 'not_active',
  'and nothing new can be assigned');

select * from finish();
rollback;
