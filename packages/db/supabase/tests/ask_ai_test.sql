-- M5-04: the Ask AI screen's data. A referral (a pain question) records a pain report the athlete's coach sees; Add to
-- Today puts published lessons on the athlete's day; the screen shows the questions left today.
begin;
select plan(14);

insert into auth.users (id, email, email_confirmed_at) values
  ('b4000000-0000-0000-0000-0000000000a1', 'ask-kabir@t.test', now()),
  ('b4000000-0000-0000-0000-0000000000a2', 'ask-neha@t.test', now()),
  ('b4000000-0000-0000-0000-0000000000c1', 'ask-coach@t.test', now()),
  ('b4000000-0000-0000-0000-0000000000c2', 'ask-other@t.test', now());
insert into public.user_roles (user_id, role) values ('b4000000-0000-0000-0000-0000000000c1', 'coach'), ('b4000000-0000-0000-0000-0000000000c2', 'coach');
-- Everyone here has passed sign-up step 1, which asking the AI guide needs (M6-15).
update public.profiles set date_of_birth = '1995-01-01' where id::text like 'b4000000%';
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
insert into ids select 'topic', public.reserve_ai_question('Does the jab strain the shoulder?');
select is(public.ai_questions_left(), 8, 'one fewer for each question asked');

-- The referral records a pain report.
reset role;
set local role service_role;
select public.finish_ai_question((select id from ids where name = 'pain'), 'referral', '{"text": "See a doctor or physiotherapist.", "pain": true}'::jsonb, 0, 0, 0);
-- A referral for a question that describes no symptom tells the coach nothing.
select public.finish_ai_question((select id from ids where name = 'topic'), 'referral', '{"text": "See a doctor or physiotherapist."}'::jsonb, 0, 0, 0);
reset role;
set local role authenticated;
select is((select count(*)::int from public.pain_reports), 1, 'only a described symptom records a pain report, which the athlete can see');
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
-- At most 10 a day; ones already on today do not take the places of new ones.
reset role;
insert into public.content_items (id, discipline_id, kind, slug, title, status, published_at)
  select ('b6000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, (select id from d), 'drill', 'ask-many-' || n, 'Drill ' || n, 'published', now() from generate_series(10, 20) n;
set local role authenticated;
select is(public.add_to_today(array(select ('b6000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid from generate_series(10, 17) n)), 8, 'eight more go on (nine today)');
select is(public.add_to_today(array['b6000000-0000-0000-0000-000000000001'::uuid, 'b6000000-0000-0000-0000-000000000018'::uuid, 'b6000000-0000-0000-0000-000000000019'::uuid]), 1,
  'the tenth place goes to a new item, not one already on today; then today is full');
select pg_temp.as_user('b4000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.today_extras), 0, 'someone else sees none of it');

select * from finish();
rollback;
