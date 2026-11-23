-- M5-03: the daily question limit and the usage log. 10 questions a day (India time); the 11th is refused. Each
-- question logs its user, tokens and cost; only its owner reads it.
begin;
select plan(15);

insert into auth.users (id, email, email_confirmed_at) values
  ('b3000000-0000-0000-0000-0000000000a1', 'ai-kabir@t.test', now()),
  ('b3000000-0000-0000-0000-0000000000a2', 'ai-neha@t.test', now()),
  ('b3000000-0000-0000-0000-0000000000c1', 'ai-coach@t.test', now());
-- The coach is a coach only.
delete from public.user_roles where user_id = 'b3000000-0000-0000-0000-0000000000c1';
insert into public.user_roles (user_id, role) values ('b3000000-0000-0000-0000-0000000000c1', 'coach');
-- Everyone here has passed sign-up step 1, which asking the AI guide needs (M6-15).
update public.profiles set date_of_birth = '1995-01-01' where id::text like 'b3000000%';

create temp table ids (n int primary key, id uuid);
grant all on ids to authenticated, service_role;
create function pg_temp.as_user(uid text) returns void language sql as $$ select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', uid), true) $$;
set local role authenticated;
select pg_temp.as_user('b3000000-0000-0000-0000-0000000000a1');

select is(public.ai_daily_limit(), 10, 'ten questions a day');
insert into ids select n, public.reserve_ai_question('Question ' || n) from generate_series(1, 10) n;
select is((select count(*)::int from ids), 10, 'ten questions are taken');
select throws_ok($$ select public.reserve_ai_question('Question 11') $$, '22023', 'ai_daily_limit', 'the 11th question of the day is refused');
select throws_ok($$ select public.reserve_ai_question('   ') $$, '22023', 'bad_question', 'an empty question is refused');
select throws_ok($$ insert into public.ai_questions (user_id, question) values ('b3000000-0000-0000-0000-0000000000a1', 'x') $$, '42501', null, 'no direct writes');

-- The server records each answer with its tokens and cost; the athlete cannot.
select throws_ok(format($$ select public.finish_ai_question(%L, 'answer', '{}'::jsonb, 1, 1, 1) $$, (select id from ids where n = 1)), '42501', null,
  'the athlete cannot write their own usage');
reset role;
set local role service_role;
select public.finish_ai_question((select id from ids where n = 1), 'answer', '{"text": "Hands high."}'::jsonb, 1200, 300, 10800);
-- A failed answer that cost nothing gives the question back; one that used tokens still counts.
select public.finish_ai_question((select id from ids where n = 2), 'unavailable', '{"text": "Try again."}'::jsonb, 0, 0, 0);
select public.finish_ai_question((select id from ids where n = 3), 'unavailable', '{"text": "Try again."}'::jsonb, 900, 16000, 323600);
select is((select status from public.ai_questions where id = (select id from ids where n = 3)), 'answered', 'a paid failure still counts, so it cannot be used to ask without limit');
select is((select row(status, kind, input_tokens, output_tokens, cost_micro_usd)::text from public.ai_questions where id = (select id from ids where n = 1)),
  row('answered', 'answer', 1200, 300, 10800::bigint)::text, 'the answer is logged with its tokens and cost');
reset role;
set local role authenticated;
select pg_temp.as_user('b3000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.reserve_ai_question('Question 11') $$, 'a failed answer that cost nothing gives the question back');
select is((select count(*)::int from public.ai_questions), 11, 'the athlete reads their own questions');
-- A question still being answered counts all day: the server always finishes what it reserves.
reset role;
update public.ai_questions set created_at = created_at - interval '1 hour' where status = 'pending';
set local role authenticated;
select throws_ok($$ select public.reserve_ai_question('Question 12') $$, '22023', 'ai_daily_limit', 'a question still pending keeps counting');

-- Yesterday's questions do not count today.
reset role;
update public.ai_questions set asked_on = asked_on - 1, created_at = created_at - interval '1 day' where user_id = 'b3000000-0000-0000-0000-0000000000a1';
set local role authenticated;
select lives_ok($$ select public.reserve_ai_question('A new day') $$, 'a new day starts a new count');
-- However questions end, no more than twice the limit can be started in a day.
reset role;
insert into public.ai_questions (user_id, question, status, kind) select 'b3000000-0000-0000-0000-0000000000a1', 'free failure ' || n, 'failed', 'unavailable' from generate_series(1, 19) n;
set local role authenticated;
select throws_ok($$ select public.reserve_ai_question('one more') $$, '22023', 'ai_daily_limit', 'at most 20 questions are started in a day, even if they all fail');

select pg_temp.as_user('b3000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.ai_questions), 0, 'someone else reads none of them');
select pg_temp.as_user('b3000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.reserve_ai_question('x') $$, '42501', 'not_athlete', 'the guide is for athletes');

select * from finish();
rollback;
