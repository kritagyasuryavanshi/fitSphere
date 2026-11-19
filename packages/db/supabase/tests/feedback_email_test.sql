-- M3-14: feedback queues one email to the athlete, unless they turned feedback emails off.
begin;
select plan(7);

insert into auth.users (id, email, email_confirmed_at) values
  ('ab000000-0000-0000-0000-0000000000a1', 'coach-e@t.test', now()),
  ('cb000000-0000-0000-0000-0000000000c1', 'kabir-e@t.test', now()),
  ('db000000-0000-0000-0000-0000000000d1', 'neha-e@t.test', now());
insert into public.user_roles (user_id, role) values ('ab000000-0000-0000-0000-0000000000a1', 'coach');
update public.profiles set display_name = 'Vikram', date_of_birth = '1990-01-01' where id = 'ab000000-0000-0000-0000-0000000000a1';
update public.profiles set display_name = 'Kabir', date_of_birth = '1998-06-12' where id = 'cb000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Neha', date_of_birth = '1996-02-02' where id = 'db000000-0000-0000-0000-0000000000d1';
insert into public.athlete_basics (user_id, days_per_week) values ('cb000000-0000-0000-0000-0000000000c1', 3);

create temp table ids (name text primary key, v text);
grant all on ids to authenticated;
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"ab000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into ids select 'p', public.create_program('Ring Basics', 'boxing');
select public.save_program_draft((select v from ids where name = 'p')::uuid, 'Ring Basics', '', 4, jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'items',
  jsonb_build_array(jsonb_build_object('item', (select id from public.content_items where slug = 'skipping'), 'type', 'time', 'seconds', 300)))));
select public.publish_program((select v from ids where name = 'p')::uuid);
insert into ids select 'c', public.program_invite((select v from ids where name = 'p')::uuid);
select set_config('request.jwt.claims', '{"sub":"cb000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into ids select 'e', public.join_program((select v from ids where name = 'c'));

select set_config('request.jwt.claims', '{"sub":"ab000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.give_feedback((select v from ids where name = 'e')::uuid, 'Keep the rear hand glued to your cheek.', null);
reset role;
select is((select count(*)::int from public.email_outbox where to_email = 'kabir-e@t.test' and template = 'coach_feedback'), 1, 'feedback queues one email to the athlete');
select is((select data ->> 'coach' || '|' || (data ->> 'program') || '|' || (data ->> 'excerpt') from public.email_outbox where to_email = 'kabir-e@t.test'),
  'Vikram|Ring Basics|Keep the rear hand glued to your cheek.', 'with the coach, program and the note');
set local role authenticated;

-- Kabir turns feedback emails off.
select set_config('request.jwt.claims', '{"sub":"cb000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select coach_feedback from public.my_email_prefs()), true, 'feedback emails are on until the athlete turns them off');
select lives_ok($$ select public.set_email_pref('coach_feedback', false) $$, 'the athlete turns feedback emails off');
select is((select coach_feedback from public.my_email_prefs()), false, 'and the switch reads off');
select throws_ok($$ select public.set_email_pref('no_such_email', false) $$, '22023', 'bad_pref', 'an unknown email kind is refused');

select set_config('request.jwt.claims', '{"sub":"ab000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.give_feedback((select v from ids where name = 'e')::uuid, 'Second note.', null);
reset role;
select is((select count(*)::int from public.email_outbox where to_email = 'kabir-e@t.test'), 1, 'no email once the athlete turned the setting off');

select * from finish();
rollback;
