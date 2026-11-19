-- M3-11: the body weight log. The athlete logs one weight per India day; only they and their current coach read it.
begin;
select plan(9);

insert into auth.users (id, email, email_confirmed_at) values
  ('a8000000-0000-0000-0000-0000000000a1', 'coach-w@t.test', now()),
  ('b8000000-0000-0000-0000-0000000000b1', 'coach-x@t.test', now()),
  ('c8000000-0000-0000-0000-0000000000c1', 'kabir-w@t.test', now());
insert into public.user_roles (user_id, role) values ('a8000000-0000-0000-0000-0000000000a1', 'coach'), ('b8000000-0000-0000-0000-0000000000b1', 'coach');
update public.profiles set display_name = 'Kabir', date_of_birth = '1998-06-12' where id = 'c8000000-0000-0000-0000-0000000000c1';
insert into public.athlete_basics (user_id, days_per_week) values ('c8000000-0000-0000-0000-0000000000c1', 3);

create temp table ids (name text primary key, v text);
grant all on ids to authenticated;
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"a8000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into ids select 'p', public.create_program('Gym Base', 'gym');
select public.save_program_draft((select v from ids where name = 'p')::uuid, 'Gym Base', '', 4, jsonb_build_array(
  jsonb_build_object('week', 1, 'day', 1, 'items', jsonb_build_array(
    jsonb_build_object('item', (select id from public.content_items where slug = 'back-squat'), 'type', 'sets', 'sets', 3, 'reps', 8)))));
select public.publish_program((select v from ids where name = 'p')::uuid);
insert into ids select 'c', public.program_invite((select v from ids where name = 'p')::uuid);

select set_config('request.jwt.claims', '{"sub":"c8000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into ids select 'e', public.join_program((select v from ids where name = 'c'));

select lives_ok($$ select public.log_body_weight(72.4) $$, 'the athlete logs a weight');
select lives_ok($$ select public.log_body_weight(72.1) $$, 'and logs again the same day');
select is((select string_agg(weight_kg::text, ',') from public.body_metrics), '72.1', 'one weight per day: the second replaces the first');
select throws_ok($$ select public.log_body_weight(19.9) $$, '22023', 'bad_weight', 'a weight under 20 kg is refused');
select throws_ok($$ select public.log_body_weight(72.45) $$, '22023', 'bad_weight', 'more than one decimal is refused');

select set_config('request.jwt.claims', '{"sub":"a8000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.body_metrics where user_id = 'c8000000-0000-0000-0000-0000000000c1'), 1, 'his coach reads his body weight');
select set_config('request.jwt.claims', '{"sub":"b8000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from public.body_metrics), 0, 'another coach does not');

select set_config('request.jwt.claims', '{"sub":"c8000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select public.leave_program((select v from ids where name = 'e')::uuid);
select set_config('request.jwt.claims', '{"sub":"a8000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.body_metrics), 0, 'after he leaves, his coach reads none');
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.body_metrics $$, '42501', null, 'a guest cannot read the table at all');

select * from finish();
rollback;
