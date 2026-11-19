-- M3-16: in-app notifications. A user reads only their own. Feedback, a coach's new lesson and today's session each
-- notify the athlete; email for each follows the athlete's switch.
begin;
select plan(14);

insert into auth.users (id, email, email_confirmed_at) values
  ('ac000000-0000-0000-0000-0000000000a1', 'coach-n@t.test', now()),
  ('cc000000-0000-0000-0000-0000000000c1', 'kabir-n@t.test', now()),
  ('dc000000-0000-0000-0000-0000000000d1', 'neha-n@t.test', now());
insert into public.user_roles (user_id, role) values ('ac000000-0000-0000-0000-0000000000a1', 'coach');
update public.profiles set display_name = 'Vikram', date_of_birth = '1990-01-01' where id = 'ac000000-0000-0000-0000-0000000000a1';
update public.profiles set display_name = 'Kabir', date_of_birth = '1998-06-12' where id = 'cc000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Neha', date_of_birth = '1996-02-02' where id = 'dc000000-0000-0000-0000-0000000000d1';
insert into public.athlete_basics (user_id, days_per_week) values ('cc000000-0000-0000-0000-0000000000c1', 3), ('dc000000-0000-0000-0000-0000000000d1', 3);

create temp table ids (name text primary key, v text);
grant all on ids to authenticated, service_role;
set local role authenticated;

-- Vikram's program with a session on day 1; Kabir joins today, so day 1 is today.
select set_config('request.jwt.claims', '{"sub":"ac000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into ids select 'p', public.create_program('Ring Basics', 'boxing');
select public.save_program_draft((select v from ids where name = 'p')::uuid, 'Ring Basics', '', 4, jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'title', 'Jab', 'items',
  jsonb_build_array(jsonb_build_object('item', (select id from public.content_items where slug = 'skipping'), 'type', 'time', 'seconds', 300)))));
select public.publish_program((select v from ids where name = 'p')::uuid);
insert into ids select 'c', public.program_invite((select v from ids where name = 'p')::uuid);
select set_config('request.jwt.claims', '{"sub":"cc000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into ids select 'e', public.join_program((select v from ids where name = 'c'));

-- Feedback.
select set_config('request.jwt.claims', '{"sub":"ac000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select public.give_feedback((select v from ids where name = 'e')::uuid, 'Keep the rear hand up.', null);
select set_config('request.jwt.claims', '{"sub":"cc000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select string_agg(kind || '|' || (read_at is null)::text, ',') from public.notifications), 'coach_feedback|true', 'feedback notifies the athlete, unread');
select is((select link from public.notifications where kind = 'coach_feedback'), '/account/feedback', 'and links to Coach feedback');
select throws_ok($$ insert into public.notifications (user_id, kind, title) values ('cc000000-0000-0000-0000-0000000000c1', 'coach_feedback', 'x') $$, '42501', null, 'clients cannot write notifications');

select set_config('request.jwt.claims', '{"sub":"dc000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.notifications), 0, 'someone else reads none of them');
select is(public.mark_notifications_read(), 0, 'and marking all read touches none of them');

select set_config('request.jwt.claims', '{"sub":"cc000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(public.mark_notifications_read(), 1, 'Mark all as read marks the athlete''s one');
select is((select count(*)::int from public.notifications where read_at is null), 0, 'so none is unread');

-- A new lesson from the athlete's coach goes live.
reset role;
insert into ids select 'item', id::text from public.content_items where slug = 'jab' limit 1;
update public.content_items set author_id = 'ac000000-0000-0000-0000-0000000000a1', status = 'draft' where id = (select v from ids where name = 'item')::uuid;
update public.content_items set status = 'published' where id = (select v from ids where name = 'item')::uuid;
select is((select count(*)::int from public.notifications where user_id = 'cc000000-0000-0000-0000-0000000000c1' and kind = 'new_lesson'), 1,
  'a coach''s lesson going live notifies their athletes');
select is((select count(*)::int from public.notifications where user_id = 'dc000000-0000-0000-0000-0000000000d1'), 0, 'not people outside their programs');
select is((select count(*)::int from public.email_outbox where to_email = 'kabir-n@t.test' and template = 'new_lesson'), 1, 'lesson emails are on by default');

-- Today's session reminder, from the daily job.
set local role authenticated;
select throws_ok($$ select public.queue_session_reminders() $$, '42501', null, 'only the server runs the reminder job');
reset role;
set local role service_role;
select is(public.queue_session_reminders(), 1, 'the job reminds the athlete with a session today');
select is(public.queue_session_reminders(), 0, 'and only once a day');
reset role;
select is((select count(*)::int from public.email_outbox where to_email = 'kabir-n@t.test' and template = 'session_reminder'), 0, 'reminder emails are off by default');

select * from finish();
rollback;
