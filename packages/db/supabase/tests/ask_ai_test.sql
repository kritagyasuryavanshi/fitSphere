-- M5-04: the Ask AI screen's data. A referral (a pain question) records a pain report the athlete's coach sees; Add to
-- Today puts published lessons on the athlete's day; the screen shows the questions left today.
begin;
select plan(12);

insert into auth.users (id, email, email_confirmed_at) values
  ('b4000000-0000-0000-0000-0000000000a1', 'ask-kabir@t.test', now()),
  ('b4000000-0000-0000-0000-0000000000a2', 'ask-neha@t.test', now()),
  ('b4000000-0000-0000-0000-0000000000c1', 'ask-coach@t.test', now()),
  ('b4000000-0000-0000-0000-0000000000c2', 'ask-other@t.test', now());
insert into public.user_roles (user_id, role) values ('b4000000-0000-0000-0000-0000000000c1', 'coach'), ('b4000000-0000-0000-0000-0000000000c2', 'coach');
-- Kabir is in the coach's program.
insert into public.programs (id, coach_id, category_id, title, weeks) values ('b5000000-0000-0000-0000-0000000000f1', 'b4000000-0000-0000-0000-0000000000c1', 'boxing', 'Basics', 4);
insert into public.program_versions (program_id, version, published_at, effective_from, weeks, title, summary) values ('b5000000-0000-0000-0000-0000000000f1', 1, now(), current_date, 4, 'Basics', '');
insert into public.enrollments (program_id, athlete_id, start_date) values ('b5000000-0000-0000-0000-0000000000f1', 'b4000000-0000-0000-0000-0000000000a1', current_date);
create temp table d as select di.id from public.disciplines di join public.categories c on c.id = di.category_id where c.is_live order by di.sort limit 1;
insert into public.content_items (id, discipline_id, kind, slug, title, status, published_at) values
  ('b6000000-0000-0000-0000-000000000001', (select id from d), 'drill', 'ask-stationary-jab', 'Stationary jab', 'published', now()),
  ('b6000000-0000-0000-0000-000000000002', (select id from d), 'drill', 'ask-draft', 'Draft drill', 'draft', null);

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated, service_role;
create function pg_temp.as_user(uid text) returns void language sql as $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', uid), true) $$;
set local role authenticated;
select pg_temp.as_user('b4000000-0000-0000-0000-0000000000a1');

select is(public.ai_questions_left(), 10, 'ten questions left at the start of the day');
insert into ids select 'pain', public.reserve_ai_question('My right shoulder hurts after bag work');
select is(public.ai_questions_left(), 9, 'one fewer after asking');

-- The referral records a pain report.
reset role;
set local role service_role;
select public.finish_ai_question((select id from ids where name = 'pain'), 'referral', '{"text": "See a doctor or physiotherapist."}'::jsonb, 0, 0, 0);
reset role;
set local role authenticated;
select is((select count(*)::int from public.pain_reports), 1, 'a pain question records a pain report the athlete can see');
select is((select reported_on from public.pain_reports), public.india_today(), 'dated today, India time');
select pg_temp.as_user('b4000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.pain_reports where athlete_id = 'b4000000-0000-0000-0000-0000000000a1'), 1, 'the athlete''s coach sees it');
select pg_temp.as_user('b4000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from public.pain_reports), 0, 'another coach does not');
select pg_temp.as_user('b4000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.pain_reports), 0, 'nor another athlete');

-- Add to Today: published items only, on the athlete's own day.
select pg_temp.as_user('b4000000-0000-0000-0000-0000000000a1');
select is(public.add_to_today(array['b6000000-0000-0000-0000-000000000001'::uuid, 'b6000000-0000-0000-0000-000000000002'::uuid]), 1,
  'only the published item is added');
select is(public.add_to_today(array['b6000000-0000-0000-0000-000000000001'::uuid]), 0, 'adding it again adds nothing');
select is((select item_id from public.today_extras where on_date = public.india_today()), 'b6000000-0000-0000-0000-000000000001'::uuid, 'it is on today');
select throws_ok($$ insert into public.today_extras (athlete_id, item_id) values ('b4000000-0000-0000-0000-0000000000a1', 'b6000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'no direct writes');
select pg_temp.as_user('b4000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.today_extras), 0, 'someone else sees none of it');

select * from finish();
rollback;
