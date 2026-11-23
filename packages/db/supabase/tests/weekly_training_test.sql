-- S0-08: the one usage number, for admins only: distinct athletes who completed a session, per India week
-- (Monday start), for the last N weeks. Usage analytics are cut (decision-m6-launch).
begin;
select plan(5);

insert into auth.users (id, email, email_confirmed_at) values
  ('5e000000-0000-0000-0000-0000000000a1', 'wk-a@t.test', now()),
  ('5e000000-0000-0000-0000-0000000000a2', 'wk-b@t.test', now()),
  ('5e000000-0000-0000-0000-0000000000ad', 'wk-admin@t.test', now());
insert into public.user_roles (user_id, role) values ('5e000000-0000-0000-0000-0000000000ad', 'admin');
delete from public.session_logs;
-- A trains twice this week, B once; B also trained last week; one session this week was opened but not completed.
insert into public.session_logs (athlete_id, on_date, category_id, completed_at) values
  ('5e000000-0000-0000-0000-0000000000a1', public.india_today(), 'boxing', now()),
  ('5e000000-0000-0000-0000-0000000000a1', public.india_today(), 'gym', now()),
  ('5e000000-0000-0000-0000-0000000000a2', public.india_today(), 'boxing', now()),
  ('5e000000-0000-0000-0000-0000000000a2', public.india_today() - 7, 'boxing', now() - interval '7 days'),
  ('5e000000-0000-0000-0000-0000000000a2', public.india_today(), 'sc', null);

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
set local role authenticated;

select pg_temp.as_user('5e000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select * from public.admin_weekly_training(4) $$, '42501', null, 'a non-admin cannot read it');

select pg_temp.as_user('5e000000-0000-0000-0000-0000000000ad');
select is((select count(*)::int from public.admin_weekly_training(4)), 4, 'one row per week, empty weeks included');
select is((select athletes from public.admin_weekly_training(4) order by week_start desc limit 1), 2, 'this week: two distinct athletes');
select is((select athletes from public.admin_weekly_training(4) order by week_start desc offset 1 limit 1), 1, 'last week: one athlete');
select is((select extract(isodow from week_start)::int from public.admin_weekly_training(1)), 1, 'weeks start on Monday');

select * from finish();
rollback;
