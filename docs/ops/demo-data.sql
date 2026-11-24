-- Demo data for the live site (owner's request, 2026-11-24). One fictional coach, clearly labelled as a demo, with
-- packages, weekly hours and a published program shown on the profile. No reviews, stories or client numbers:
-- those would be invented evidence. The account cannot sign in (no password, an .invalid address).
-- Remove it all with docs/ops/demo-data-remove.sql.
-- Run: npx supabase db query --remote -f docs/ops/demo-data.sql   (from packages/db)

begin;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('d0000000-0000-4000-8000-00000000c0a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'demo-coach@fitsphere.invalid', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.profiles set display_name = 'Arjun Mehta (demo)', date_of_birth = '1990-04-15' where id = 'd0000000-0000-4000-8000-00000000c0a1';
insert into public.user_roles (user_id, role) values ('d0000000-0000-4000-8000-00000000c0a1', 'coach') on conflict do nothing;

insert into public.coach_profiles (coach_id, headline, philosophy, specialties, languages, formats, city, years, client_limit,
  agreement_version, agreement_accepted_at, status)
values ('d0000000-0000-4000-8000-00000000c0a1',
  'Demo profile: boxing fundamentals and ring fitness',
  'This is a demo coach profile, so you can see how a coach page looks before the first coaches join. A real coach writes here how they train people: fundamentals first, honest feedback on every session, and steady progress you can measure week to week.',
  array['Boxing', 'Strength & Conditioning'], array['English', 'Hindi'], array['online', 'in_person'], 'Mumbai', 8, 10,
  public.current_coach_agreement(), now(), 'live');

insert into public.packages (id, coach_id, title, kind, price_paise, live, minutes) values
  ('d0000000-0000-4000-8000-0000000000b1', 'd0000000-0000-4000-8000-00000000c0a1', 'Monthly online coaching', 'monthly', 450000, true, null),
  ('d0000000-0000-4000-8000-0000000000b2', 'd0000000-0000-4000-8000-00000000c0a1', 'Single form check (video call)', 'single', 120000, true, 60);

-- Weekday mornings and evenings, Saturday morning. India time.
insert into public.availability_slots (coach_id, dow, start_time, minutes)
select 'd0000000-0000-4000-8000-00000000c0a1'::uuid, d, t::time, 120
from generate_series(1, 5) d, unnest(array['06:30', '18:00']) t
union all select 'd0000000-0000-4000-8000-00000000c0a1'::uuid, 6, '07:00'::time, 180;

-- A six-week boxing program built from the published sample lessons, shown on the profile.
insert into public.programs (id, coach_id, category_id, title, weeks, show_on_profile)
values ('d0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-00000000c0a1', 'boxing', 'Boxing Fundamentals (demo)', 6, true);
insert into public.program_versions (id, program_id, version, published_at, effective_from, title, summary, weeks) values
  ('d0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-0000000000a1', 1, now(), public.india_today(),
   'Boxing Fundamentals (demo)', 'Stance, guard, the jab and the cross, three sessions a week. A demo program.', 6);
insert into public.program_versions (program_id, version) values ('d0000000-0000-4000-8000-0000000000a1', 2);

insert into public.program_sessions (id, version_id, week, day, position, title) values
  ('d0000000-0000-4000-8000-0000000000e1', 'd0000000-0000-4000-8000-0000000000f1', 1, 1, 1, 'Stance and guard'),
  ('d0000000-0000-4000-8000-0000000000e2', 'd0000000-0000-4000-8000-0000000000f1', 1, 3, 2, 'The jab'),
  ('d0000000-0000-4000-8000-0000000000e3', 'd0000000-0000-4000-8000-0000000000f1', 1, 5, 3, 'Jab and cross');
insert into public.session_items (session_id, position, item_id, type, prescription, cue)
select s.sid, s.pos, c.id, s.typ::public.prescription_type, s.rx::jsonb, s.cue
from (values
  ('d0000000-0000-4000-8000-0000000000e1'::uuid, 1, 'stance', 'rounds', '{"rounds": 3, "work_s": 120, "rest_s": 60}', 'Weight on the balls of your feet.'),
  ('d0000000-0000-4000-8000-0000000000e1'::uuid, 2, 'guard', 'rounds', '{"rounds": 3, "work_s": 120, "rest_s": 60}', 'Hands back to the chin every time.'),
  ('d0000000-0000-4000-8000-0000000000e2'::uuid, 1, 'jab', 'rounds', '{"rounds": 4, "work_s": 180, "rest_s": 60}', 'Snap it back to the chin.'),
  ('d0000000-0000-4000-8000-0000000000e2'::uuid, 2, 'skipping', 'time', '{"seconds": 300}', ''),
  ('d0000000-0000-4000-8000-0000000000e3'::uuid, 1, 'jab', 'rounds', '{"rounds": 2, "work_s": 180, "rest_s": 60}', ''),
  ('d0000000-0000-4000-8000-0000000000e3'::uuid, 2, 'one-two', 'rounds', '{"rounds": 4, "work_s": 180, "rest_s": 60}', 'Turn the back hip on the cross.')
) s (sid, pos, slug, typ, rx, cue)
join lateral (select x.id from public.content_items x where x.slug = s.slug and x.status = 'published' limit 1) c on true;

commit;
