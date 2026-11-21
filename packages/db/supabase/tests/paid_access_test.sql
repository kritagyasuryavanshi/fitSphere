-- M4-10: a paid engagement opens coach access like an enrollment, but only with the athlete's sharing choice, and
-- closes when the coaching ends or is refunded. The coach assigns a program to a paying client; that enrollment ends
-- with the coaching. coach_stats counts paid clients.
begin;
select plan(24);

-- Coach Vikram (live) and coach Ananya. Kabir pays and shares; Neha pays and does not share; Ravi is accepted but has
-- not paid; Isha is cancelling (still paid to the end of the month) and shares.
insert into auth.users (id, email, email_confirmed_at) values
  ('e1000000-0000-0000-0000-0000000000c1', 'pa-vikram@t.test', now()),
  ('e1000000-0000-0000-0000-0000000000c2', 'pa-ananya@t.test', now()),
  ('e1000000-0000-0000-0000-0000000000a1', 'pa-kabir@t.test', now()),
  ('e1000000-0000-0000-0000-0000000000a2', 'pa-neha@t.test', now()),
  ('e1000000-0000-0000-0000-0000000000a3', 'pa-ravi@t.test', now()),
  ('e1000000-0000-0000-0000-0000000000a4', 'pa-isha@t.test', now());
insert into public.user_roles (user_id, role) values
  ('e1000000-0000-0000-0000-0000000000c1', 'coach'), ('e1000000-0000-0000-0000-0000000000c2', 'coach');
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('e1000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement()),
  ('e1000000-0000-0000-0000-0000000000c2', 'Gym', 'live', public.current_coach_agreement());
insert into public.athlete_basics (user_id, days_per_week, injury_notes) values
  ('e1000000-0000-0000-0000-0000000000a1', 3, 'old left knee'), ('e1000000-0000-0000-0000-0000000000a2', 3, 'shoulder'),
  ('e1000000-0000-0000-0000-0000000000a3', 3, ''), ('e1000000-0000-0000-0000-0000000000a4', 3, '');
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data, paid_through) values
  ('e2000000-0000-0000-0000-0000000000e1', 'e1000000-0000-0000-0000-0000000000a1', 'e1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 5, 3, 'active', true, public.india_today() + 25),
  ('e2000000-0000-0000-0000-0000000000e2', 'e1000000-0000-0000-0000-0000000000a2', 'e1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 5, 3, 'active', false, public.india_today() + 25),
  ('e2000000-0000-0000-0000-0000000000e3', 'e1000000-0000-0000-0000-0000000000a3', 'e1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today(), 3, 'accepted', true, null),
  ('e2000000-0000-0000-0000-0000000000e4', 'e1000000-0000-0000-0000-0000000000a4', 'e1000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 20, 3, 'cancelling', true, public.india_today() + 10);

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
insert into ids select 'ek', public.assign_program('e2000000-0000-0000-0000-0000000000e1', (select v from ids where name = 'pv'));
select is((select row(athlete_id, status::text, engagement_id, start_date)::text from public.enrollments where id = (select v from ids where name = 'ek')),
  row('e1000000-0000-0000-0000-0000000000a1'::uuid, 'active', 'e2000000-0000-0000-0000-0000000000e1'::uuid, public.india_today())::text,
  'assigning enrolls the client from today, tied to the engagement');
select is(public.assign_program('e2000000-0000-0000-0000-0000000000e1', (select v from ids where name = 'pv')), (select v from ids where name = 'ek'),
  'assigning again returns the same enrollment');
select ok(public.coach_reads_program('e1000000-0000-0000-0000-0000000000a1', (select v from ids where name = 'pv')),
  'the coach reads the client''s logs in the assigned program');
insert into ids select 'en', public.assign_program('e2000000-0000-0000-0000-0000000000e2', (select v from ids where name = 'pv'));
select ok(not public.coach_reads_program('e1000000-0000-0000-0000-0000000000a2', (select v from ids where name = 'pv'))
  and not public.coach_can_read('e1000000-0000-0000-0000-0000000000a2'),
  'an assigned program does not open the logs of a client who does not share');

-- The client sees the assigned program, and cannot assign one themselves.
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select title from public.my_programs()), 'Boxing Fundamentals', 'the client sees the assigned program in My programs');
select throws_ok($$ select public.assign_program('e2000000-0000-0000-0000-0000000000e1', (select v from ids where name = 'pv')) $$, '42501', 'not_yours',
  'the client cannot assign programs');

-- coach_stats counts paid clients (Kabir, Neha, Isha), not the unpaid request (Ravi).
reset role;
select is((select athletes from public.coach_stats('e1000000-0000-0000-0000-0000000000c1')), 3, 'paid coaching clients count as athletes');
update public.engagements set status = 'refunded', ended_at = now() where id = 'e2000000-0000-0000-0000-0000000000e2';
select is((select athletes from public.coach_stats('e1000000-0000-0000-0000-0000000000c1')), 2, 'a refunded client does not count');

-- The coaching ends: the assigned program ends with it, and the coach's access closes.
update public.engagements set status = 'ended', ended_at = now() where id = 'e2000000-0000-0000-0000-0000000000e1';
select is((select status::text from public.enrollments where id = (select v from ids where name = 'ek')), 'ended', 'the assigned program ends with the coaching');
select is((select status::text from public.enrollments where id = (select v from ids where name = 'en')), 'ended', 'and with a refund');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select ok(not public.coach_can_read('e1000000-0000-0000-0000-0000000000a1'), 'the coach''s access closes when the coaching ends');
select ok(not public.coach_reads_program('e1000000-0000-0000-0000-0000000000a1', (select v from ids where name = 'pv')), 'logs included');
select throws_ok($$ select public.assign_program('e2000000-0000-0000-0000-0000000000e1', (select v from ids where name = 'pv')) $$, '22023', 'not_active',
  'and nothing new can be assigned');

select * from finish();
rollback;
