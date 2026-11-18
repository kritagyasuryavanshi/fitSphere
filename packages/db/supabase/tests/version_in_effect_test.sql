-- M3-06: athletes see the version in effect, never the coach's unpublished draft.
begin;
select plan(9);

insert into auth.users (id, email, email_confirmed_at) values
  ('a1000000-0000-0000-0000-0000000000a1', 'coach@t.test', now()),
  ('c1000000-0000-0000-0000-0000000000c1', 'kabir@t.test', now());
insert into public.user_roles (user_id, role) values ('a1000000-0000-0000-0000-0000000000a1', 'coach');
update public.profiles set display_name = 'Vikram' where id = 'a1000000-0000-0000-0000-0000000000a1';
update public.profiles set display_name = 'Kabir', date_of_birth = '1998-06-12' where id = 'c1000000-0000-0000-0000-0000000000c1';
insert into public.athlete_basics (user_id, days_per_week) values ('c1000000-0000-0000-0000-0000000000c1', 3);

create temp table ids (name text primary key, v text);
grant all on ids to authenticated, anon;
set local role authenticated;

-- Version 1: six weeks, published. Then a draft renamed and cut to four weeks, not published.
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into ids select 'p', public.create_program('Boxing Fundamentals', 'boxing');
select public.save_program_draft((select v from ids where name = 'p')::uuid, 'Boxing Fundamentals', 'Six weeks of basics', 6,
  jsonb_build_array(jsonb_build_object('week', 1, 'day', 1, 'title', 'Jab', 'items', '[]'::jsonb)));
select public.publish_program((select v from ids where name = 'p')::uuid);
insert into ids select 'code', public.program_invite((select v from ids where name = 'p')::uuid);
select public.save_program_draft((select v from ids where name = 'p')::uuid, 'Renamed', 'Draft summary', 4,
  jsonb_build_array(jsonb_build_object('week', 1, 'day', 2, 'title', 'Cross', 'items', '[]'::jsonb)));

select is((select title || '|' || weeks::text from public.program_versions where program_id = (select v from ids where name = 'p')::uuid and version = 1),
  'Boxing Fundamentals|6', 'publishing freezes the title and length on the version');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select title || '|' || summary || '|' || weeks::text from public.invite_info((select v from ids where name = 'code'))),
  'Boxing Fundamentals|Six weeks of basics|6', 'the invite page shows the published version, not the draft');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select public.join_program((select v from ids where name = 'code'));
select is((select title || '|' || weeks::text from public.my_programs()), 'Boxing Fundamentals|6', 'My programs shows the published title and length');
select is((select v.version from public.my_programs() m join public.program_versions v on v.id = m.version_id), 1, 'and points at version 1');

-- Version 2 is published today but starts tomorrow: today is still version 1.
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(public.publish_program((select v from ids where name = 'p')::uuid), 2, 'the coach publishes version 2');
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select title || '|' || weeks::text from public.my_programs()), 'Boxing Fundamentals|6', 'version 2 is not in effect until tomorrow');
select is((select v.version from public.program_versions v where v.id = public.version_in_effect((select v from ids where name = 'p')::uuid, public.india_today() + 1)),
  2, 'tomorrow, version 2 is in effect');

-- Once its day comes, version 2 is what the athlete sees.
reset role;
update public.program_versions set effective_from = public.india_today() where program_id = (select v from ids where name = 'p')::uuid and version = 2;
set local role authenticated;
select is((select title || '|' || weeks::text from public.my_programs()), 'Renamed|4', 'from its first day, the athlete sees version 2');
select is((select count(*)::int from public.program_sessions s join public.my_programs() m on m.version_id = s.version_id where s.day = 2), 1,
  'and its sessions');

select * from finish();
rollback;
