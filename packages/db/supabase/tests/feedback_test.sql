-- M3-13: coach feedback and athlete replies. Only the program's coach gives feedback, while the athlete is active in
-- that program; the athlete keeps reading it for good, also after leaving; the coach reads it per program.
begin;
select plan(18);

insert into auth.users (id, email, email_confirmed_at) values
  ('a9000000-0000-0000-0000-0000000000a1', 'coach-f@t.test', now()),
  ('b9000000-0000-0000-0000-0000000000b1', 'coach-g@t.test', now()),
  ('c9000000-0000-0000-0000-0000000000c1', 'kabir-f@t.test', now()),
  ('d9000000-0000-0000-0000-0000000000d1', 'neha-f@t.test', now());
insert into public.user_roles (user_id, role) values ('a9000000-0000-0000-0000-0000000000a1', 'coach'), ('b9000000-0000-0000-0000-0000000000b1', 'coach');
update public.profiles set display_name = 'Kabir', date_of_birth = '1998-06-12' where id = 'c9000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Neha', date_of_birth = '1996-02-02' where id = 'd9000000-0000-0000-0000-0000000000d1';
insert into public.athlete_basics (user_id, days_per_week) values ('c9000000-0000-0000-0000-0000000000c1', 3), ('d9000000-0000-0000-0000-0000000000d1', 3);

create temp table ids (name text primary key, v text);
grant all on ids to authenticated;
set local role authenticated;

-- Coach A runs program P, coach B runs program Q; Kabir joins both.
create function pg_temp.program(coach text, title text) returns uuid language plpgsql as $$
declare p uuid;
begin
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', coach), true);
  p := public.create_program(title, 'boxing');
  perform public.save_program_draft(p, title, '', 4, jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'items', jsonb_build_array(
    jsonb_build_object('item', (select id from public.content_items where slug = 'skipping'), 'type', 'time', 'seconds', 300)))));
  perform public.publish_program(p);
  return p;
end $$;
insert into ids select 'p', pg_temp.program('a9000000-0000-0000-0000-0000000000a1', 'Ring Basics');
insert into ids select 'cp', public.program_invite((select v from ids where name = 'p')::uuid);
insert into ids select 'q', pg_temp.program('b9000000-0000-0000-0000-0000000000b1', 'Ring Engine');
insert into ids select 'cq', public.program_invite((select v from ids where name = 'q')::uuid);
select set_config('request.jwt.claims', '{"sub":"c9000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into ids select 'ep', public.join_program((select v from ids where name = 'cp'));
select public.join_program((select v from ids where name = 'cq'));
-- Neha's log, to try attaching feedback to someone else's session.
reset role;
with x as (insert into public.session_logs (athlete_id, program_id, on_date, category_id)
  values ('d9000000-0000-0000-0000-0000000000d1', (select v from ids where name = 'p')::uuid, public.india_today(), 'boxing') returning id)
insert into ids select 'nlog', id::text from x;
set local role authenticated;

-- Giving feedback.
select set_config('request.jwt.claims', '{"sub":"a9000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into ids select 'f', public.give_feedback((select v from ids where name = 'ep')::uuid, '  Keep the rear hand glued to your cheek.  ', null);
select is((select body from public.feedback where id = (select v from ids where name = 'f')::uuid), 'Keep the rear hand glued to your cheek.', 'the coach gives feedback, trimmed');
select throws_ok(format($$ select public.give_feedback(%L, '   ', null) $$, (select v from ids where name = 'ep')), '22023', 'bad_feedback', 'empty feedback is refused');
select throws_ok(format($$ select public.give_feedback(%L, %L, null) $$, (select v from ids where name = 'ep'), repeat('x', 2001)), '22023', 'bad_feedback', 'feedback over 2,000 characters is refused');
select throws_ok(format($$ select public.give_feedback(%L, 'On this one', %L) $$, (select v from ids where name = 'ep'), (select v from ids where name = 'nlog')), '22023', 'bad_log', 'feedback cannot point at another athlete''s session');
select throws_ok(format($$ insert into public.feedback (program_id, coach_id, athlete_id, body) values (%L, %L, %L, 'x') $$,
  (select v from ids where name = 'p'), 'a9000000-0000-0000-0000-0000000000a1', 'c9000000-0000-0000-0000-0000000000c1'), '42501', null, 'clients cannot write feedback directly');

select set_config('request.jwt.claims', '{"sub":"b9000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok(format($$ select public.give_feedback(%L, 'Hi', null) $$, (select v from ids where name = 'ep')), '42501', 'not_allowed', 'another coach cannot give feedback on that program');
select is((select count(*)::int from public.feedback), 0, 'and does not read it');

-- Replies.
select set_config('request.jwt.claims', '{"sub":"c9000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.feedback), 1, 'the athlete reads the feedback');
select lives_ok(format($$ select public.reply_feedback(%L, 'Got it. Touch-and-throw before each round.') $$, (select v from ids where name = 'f')), 'the athlete replies');
select throws_ok(format($$ select public.reply_feedback(%L, '  ') $$, (select v from ids where name = 'f')), '22023', 'bad_reply', 'an empty reply is refused');

select set_config('request.jwt.claims', '{"sub":"d9000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.feedback) + (select count(*)::int from public.feedback_replies), 0, 'someone else reads none of it');
select throws_ok(format($$ select public.reply_feedback(%L, 'Me too') $$, (select v from ids where name = 'f')), '42501', 'not_allowed', 'and cannot reply');

select set_config('request.jwt.claims', '{"sub":"a9000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.feedback_replies), 1, 'the coach reads the reply');

-- Kabir leaves program P.
select set_config('request.jwt.claims', '{"sub":"c9000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select public.leave_program((select v from ids where name = 'ep')::uuid);
select is((select count(*)::int from public.feedback) + (select count(*)::int from public.feedback_replies), 2, 'after leaving, the athlete still reads the feedback and the reply');
select is(jsonb_array_length(public.export_my_data() -> 'feedback'), 1, 'and the data download lists it');
select throws_ok(format($$ select public.reply_feedback(%L, 'Are you there?') $$, (select v from ids where name = 'f')), '42501', 'not_in_program', 'but cannot reply once out of the program: the coach would never see it');

select set_config('request.jwt.claims', '{"sub":"a9000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.feedback) + (select count(*)::int from public.feedback_replies), 0, 'the coach reads none of it once he leaves');
select throws_ok(format($$ select public.give_feedback(%L, 'Still there?', null) $$, (select v from ids where name = 'ep')), '42501', 'not_allowed', 'nor gives more feedback');

select * from finish();
rollback;
