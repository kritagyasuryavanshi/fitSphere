-- M3-04: leaving, removal, and the coach access rule (coach_can_read).
begin;
select plan(25);

-- Coaches A and B, each with a published program. Kabir joins A's, Neha joins B's.
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-0000000000a1', 'coach-a@t.test', now()),
  ('b0000000-0000-0000-0000-0000000000b1', 'coach-b@t.test', now()),
  ('c0000000-0000-0000-0000-0000000000c1', 'kabir@t.test', now()),
  ('d0000000-0000-0000-0000-0000000000d1', 'neha@t.test', now());
insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-0000000000a1', 'coach'), ('b0000000-0000-0000-0000-0000000000b1', 'coach');
update public.profiles set display_name = 'Vikram' where id = 'a0000000-0000-0000-0000-0000000000a1';
update public.profiles set display_name = 'Ananya' where id = 'b0000000-0000-0000-0000-0000000000b1';
update public.profiles set display_name = 'Kabir', date_of_birth = '1998-06-12' where id = 'c0000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Neha', date_of_birth = '1996-02-02' where id = 'd0000000-0000-0000-0000-0000000000d1';
insert into public.athlete_basics (user_id, days_per_week, injury_notes) values
  ('c0000000-0000-0000-0000-0000000000c1', 3, 'old left knee'), ('d0000000-0000-0000-0000-0000000000d1', 4, '');
insert into public.athlete_prefs (user_id, category_id, answers) values
  ('c0000000-0000-0000-0000-0000000000c1', 'boxing', '{}'), ('d0000000-0000-0000-0000-0000000000d1', 'gym', '{}');

create temp table ids (name text primary key, v text);
grant all on ids to authenticated;
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into ids select 'pa', public.create_program('Boxing Fundamentals', 'boxing');
select public.save_program_draft((select v from ids where name = 'pa')::uuid, 'Boxing Fundamentals', '', 6,
  jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'title', 'Jab', 'items', '[]'::jsonb)));
select public.publish_program((select v from ids where name = 'pa')::uuid);
insert into ids select 'ca', public.program_invite((select v from ids where name = 'pa')::uuid);

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
insert into ids select 'pb', public.create_program('Muscle Builder', 'gym');
select public.save_program_draft((select v from ids where name = 'pb')::uuid, 'Muscle Builder', '', 4,
  jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'title', 'Push', 'items', '[]'::jsonb)));
select public.publish_program((select v from ids where name = 'pb')::uuid);
insert into ids select 'cb', public.program_invite((select v from ids where name = 'pb')::uuid);

select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into ids select 'ek', public.join_program((select v from ids where name = 'ca'));
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
insert into ids select 'en', public.join_program((select v from ids where name = 'cb'));

-- Coach A reads Kabir's sign-up answers, and nothing of Neha's.
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(public.coach_can_read('c0000000-0000-0000-0000-0000000000c1'), true, 'coach A can read an athlete in their program');
select is(public.coach_can_read('d0000000-0000-0000-0000-0000000000d1'), false, 'coach A cannot read coach B''s athlete');
select is((select display_name from public.profiles where id = 'c0000000-0000-0000-0000-0000000000c1'), 'Kabir', 'coach A sees Kabir''s profile');
select is((select injury_notes from public.athlete_basics where user_id = 'c0000000-0000-0000-0000-0000000000c1'), 'old left knee', 'and his training basics');
select is((select count(*)::int from public.athlete_prefs where user_id = 'c0000000-0000-0000-0000-0000000000c1'), 1, 'and his sport answers');
select is((select count(*)::int from public.profiles where id = 'd0000000-0000-0000-0000-0000000000d1'), 0, 'coach A cannot read Neha''s profile');
select is((select count(*)::int from public.athlete_basics where user_id = 'd0000000-0000-0000-0000-0000000000d1'), 0, 'or her training basics');
select is((select count(*)::int from public.athlete_prefs where user_id = 'd0000000-0000-0000-0000-0000000000d1'), 0, 'or her sport answers');

-- Nobody ends someone else's enrollment.
select throws_ok(format($$ select public.remove_athlete(%L) $$, (select v from ids where name = 'en')), '42501', 'not_owner', 'coach A cannot remove coach B''s athlete');
select throws_ok(format($$ select public.leave_program(%L) $$, (select v from ids where name = 'ek')), '42501', 'not_yours', 'a coach cannot leave on the athlete''s behalf');
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select throws_ok(format($$ select public.leave_program(%L) $$, (select v from ids where name = 'ek')), '42501', 'not_yours', 'another athlete cannot end Kabir''s enrollment');
select is(public.coach_can_read('c0000000-0000-0000-0000-0000000000c1'), false, 'an athlete without the coach role reads nobody');

-- Kabir leaves: coach A loses access at once; Kabir still sees his own record.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select lives_ok(format($$ select public.leave_program(%L) $$, (select v from ids where name = 'ek')), 'Kabir leaves the program');
select is((select status::text from public.enrollments where id = (select v from ids where name = 'ek')::uuid), 'left', 'his enrollment shows he left');
select throws_ok(format($$ select public.leave_program(%L) $$, (select v from ids where name = 'ek')), '22023', 'not_active', 'leaving twice is refused');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(public.coach_can_read('c0000000-0000-0000-0000-0000000000c1'), false, 'coach A loses access the moment Kabir leaves');
select is((select count(*)::int from public.profiles where id = 'c0000000-0000-0000-0000-0000000000c1'), 0, 'his profile is hidden again');
select is((select count(*)::int from public.athlete_basics where user_id = 'c0000000-0000-0000-0000-0000000000c1'), 0, 'and his training basics');

-- Coach B removes Neha: access ends at once, and she cannot rejoin through the link.
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok(format($$ select public.remove_athlete(%L) $$, (select v from ids where name = 'en')), 'coach B removes Neha');
select is(public.coach_can_read('d0000000-0000-0000-0000-0000000000d1'), false, 'coach B loses access the moment Neha is removed');
select is((select count(*)::int from public.athlete_prefs where user_id = 'd0000000-0000-0000-0000-0000000000d1'), 0, 'her sport answers are hidden again');
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select status::text from public.enrollments where id = (select v from ids where name = 'en')::uuid), 'removed', 'Neha sees that she was removed');
select is((select count(*)::int from public.my_programs()), 0, 'her programs list shows no active programs');

-- Kabir rejoins after leaving (leaving is his choice; removal is not).
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select public.join_program((select v from ids where name = 'ca'));
select is((select title || '|' || coach_name || '|' || weeks::text from public.my_programs()), 'Boxing Fundamentals|Vikram|6', 'after rejoining, his programs list shows the program and coach');

-- An account without the athlete role cannot join: Today is for athletes.
reset role;
insert into auth.users (id, email, email_confirmed_at) values ('e0000000-0000-0000-0000-0000000000e1', 'reviewer@t.test', now());
update public.profiles set display_name = 'Rohan', date_of_birth = '1990-01-01' where id = 'e0000000-0000-0000-0000-0000000000e1';
insert into public.athlete_basics (user_id, days_per_week) values ('e0000000-0000-0000-0000-0000000000e1', 3);
delete from public.user_roles where user_id = 'e0000000-0000-0000-0000-0000000000e1' and role = 'athlete';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok(format($$ select public.join_program(%L) $$, (select v from ids where name = 'ca')), '42501', 'not_athlete', 'an account without the athlete role cannot join');

select * from finish();
rollback;
