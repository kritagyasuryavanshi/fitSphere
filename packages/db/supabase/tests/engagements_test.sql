-- M4-07: hire requests. A request saves what was asked; the coach accepts or declines; the client limit holds.
begin;
select plan(23);

insert into auth.users (id, email, email_confirmed_at) values
  ('aa000000-0000-0000-0000-0000000000c1', 'en-coach@t.test', now()),
  ('aa000000-0000-0000-0000-0000000000c2', 'en-coach2@t.test', now()),
  ('aa000000-0000-0000-0000-0000000000b1', 'en-kabir@t.test', now()),
  ('aa000000-0000-0000-0000-0000000000b2', 'en-neha@t.test', now()),
  ('aa000000-0000-0000-0000-0000000000b3', 'en-ravi@t.test', now());
insert into public.user_roles (user_id, role) values ('aa000000-0000-0000-0000-0000000000c1', 'coach'), ('aa000000-0000-0000-0000-0000000000c2', 'coach');
update public.profiles set display_name = 'Vikram' where id = 'aa000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Kabir' where id = 'aa000000-0000-0000-0000-0000000000b1';
-- Vikram takes 1 client at a time.
insert into public.coach_profiles (coach_id, headline, status, agreement_version, client_limit) values
  ('aa000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement(), 1),
  ('aa000000-0000-0000-0000-0000000000c2', 'Draft', 'draft', public.current_coach_agreement(), 10);
insert into public.packages (id, coach_id, title, kind, price_paise, live) values
  ('ab000000-0000-0000-0000-0000000000a1', 'aa000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, true),
  ('ab000000-0000-0000-0000-0000000000a2', 'aa000000-0000-0000-0000-0000000000c1', 'Old package', 'monthly', 300000, false),
  ('ab000000-0000-0000-0000-0000000000a3', 'aa000000-0000-0000-0000-0000000000c2', 'Draft coach package', 'monthly', 300000, true);

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
create function pg_temp.as_user(uid text) returns void language sql as $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', uid), true) $$;
set local role authenticated;

-- Kabir asks Vikram.
select pg_temp.as_user('aa000000-0000-0000-0000-0000000000b1');
insert into ids select 'kabir', public.request_coaching('ab000000-0000-0000-0000-0000000000a1', public.india_today() + 3, 4::smallint, 'Clean technique. Old left knee injury.', true);
select is((select row(package_title, price_paise, fee_bps, start_date, days_per_week, goals, share_data, status)::text from public.engagements where id = (select id from ids where name = 'kabir')),
  row('Online coaching', 450000::bigint, 1500::smallint, public.india_today() + 3, 4::smallint, 'Clean technique. Old left knee injury.', true, 'requested')::text,
  'a request saves the package, its price and the fee, the start date, the days, the goals and the data-sharing choice');
select throws_ok($$ select public.request_coaching('ab000000-0000-0000-0000-0000000000a1', public.india_today() + 3, 4::smallint, 'Again', true) $$,
  '22023', 'already_open', 'one open request per coach');
select throws_ok($$ select public.request_coaching('ab000000-0000-0000-0000-0000000000a2', public.india_today() + 3, 4::smallint, 'x', true) $$,
  '22023', 'not_available', 'a package that is not live cannot be asked for');
select throws_ok($$ select public.request_coaching('ab000000-0000-0000-0000-0000000000a3', public.india_today() + 3, 4::smallint, 'x', true) $$,
  '22023', 'not_available', 'nor one from a coach who is not live');
select throws_ok($$ select public.request_coaching('ab000000-0000-0000-0000-0000000000a1', public.india_today() - 1, 4::smallint, 'x', true) $$,
  '22023', 'bad_request', 'the start date is from today to 60 days ahead');
select throws_ok($$ insert into public.engagements (athlete_id, coach_id, package_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week)
  values ('aa000000-0000-0000-0000-0000000000b1', 'aa000000-0000-0000-0000-0000000000c1', null, 'x', 'monthly', 1, 0, current_date, 3) $$,
  '42501', null, 'no direct writes');

-- Neha asks too, while Vikram still has room.
select pg_temp.as_user('aa000000-0000-0000-0000-0000000000b2');
insert into ids select 'neha', public.request_coaching('ab000000-0000-0000-0000-0000000000a1', public.india_today(), 3::smallint, 'Get fit', false);
select is((select count(*)::int from public.engagements), 1, 'an athlete sees only their own requests');

-- Vikram sees both, and was told of each.
select pg_temp.as_user('aa000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.engagements), 2, 'the coach sees requests to them');
select is((select count(*)::int from public.notifications where kind = 'new_request'), 2, 'the coach is told of each request');
select is((select string_agg(coalesce(athlete_name, '?') || ':' || status, ',' order by athlete_name) from public.coach_requests()), 'Athlete:requested,Kabir:requested',
  'the coach reads open requests with the athlete''s name');

-- Another coach cannot decide Vikram's requests.
select pg_temp.as_user('aa000000-0000-0000-0000-0000000000c2');
select throws_ok(format($$ select public.decide_request(%L, true) $$, (select id from ids where name = 'kabir')), '42501', 'not_owner', 'only the coach asked can decide');

-- Vikram accepts Kabir: his one place is taken, so Neha cannot be accepted and new requests pause.
select pg_temp.as_user('aa000000-0000-0000-0000-0000000000c1');
select lives_ok(format($$ select public.decide_request(%L, true) $$, (select id from ids where name = 'kabir')), 'the coach accepts');
select throws_ok(format($$ select public.decide_request(%L, true) $$, (select id from ids where name = 'neha')), '22023', 'coach_full',
  'an accept past the client limit fails');
select pg_temp.as_user('aa000000-0000-0000-0000-0000000000b3');
select throws_ok($$ select public.request_coaching('ab000000-0000-0000-0000-0000000000a1', public.india_today(), 3::smallint, 'x', true) $$,
  '22023', 'coach_full', 'requests pause while the coach is at the client limit');

select pg_temp.as_user('aa000000-0000-0000-0000-0000000000b1');
select is((select status from public.engagements where id = (select id from ids where name = 'kabir')), 'accepted', 'the athlete sees the accept, awaiting payment');
select throws_ok($$ select public.request_coaching('ab000000-0000-0000-0000-0000000000a1', public.india_today(), 3::smallint, 'again', true) $$,
  '22023', 'already_open', 'an athlete already with the coach is told so, not that the coach is full');
select is((select count(*)::int from public.notifications where kind = 'request_accepted'), 1, 'and is told of it');
select ok((public.export_my_data() -> 'coaching') @> '[{"coach": "Vikram", "status": "accepted"}]', 'the request is in the data download');

-- Kabir withdraws, which frees the place; Vikram declines Neha.
select lives_ok(format($$ select public.withdraw_request(%L) $$, (select id from ids where name = 'kabir')), 'the athlete withdraws');
select pg_temp.as_user('aa000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.notifications where kind = 'request_withdrawn'), 1, 'the coach is told of a withdrawal');
select throws_ok(format($$ select public.decide_request(%L, true) $$, (select id from ids where name = 'kabir')), '22023', 'not_open', 'a withdrawn request cannot be accepted');
select pg_temp.as_user('aa000000-0000-0000-0000-0000000000c1');
select public.decide_request((select id from ids where name = 'neha'), false);
select is((select string_agg(status, ',' order by status) from public.engagements), 'declined,withdrawn', 'a decline and a withdrawal close the requests');

-- Deleting an account closes its open requests, so a coach's place is never held by nobody.
select pg_temp.as_user('aa000000-0000-0000-0000-0000000000b3');
insert into ids select 'ravi', public.request_coaching('ab000000-0000-0000-0000-0000000000a1', public.india_today(), 3::smallint, 'x', true);
reset role;
delete from auth.users where id = 'aa000000-0000-0000-0000-0000000000b3';
select is((select status from public.engagements where id = (select id from ids where name = 'ravi')), 'withdrawn', 'a deleted athlete''s open request is withdrawn');
select * from finish();
rollback;
