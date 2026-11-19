-- M4-04: find_coaches filters live coaches and sorts them by fixed keys only. No payment or placement data takes part.
begin;
select plan(13);

insert into auth.users (id, email, email_confirmed_at) values
  ('a7100000-0000-0000-0000-0000000000a1', 'fc-vikram@t.test', now()),
  ('a7200000-0000-0000-0000-0000000000a2', 'fc-ananya@t.test', now()),
  ('a7300000-0000-0000-0000-0000000000a3', 'fc-rohan@t.test', now()),
  ('a7400000-0000-0000-0000-0000000000a4', 'fc-draft@t.test', now()),
  ('d7000000-0000-0000-0000-0000000000d1', 'fc-admin@t.test', now());
insert into public.user_roles (user_id, role)
  select id, 'coach' from auth.users where email like 'fc-%' and email <> 'fc-admin@t.test';
insert into public.user_roles (user_id, role) values ('d7000000-0000-0000-0000-0000000000d1', 'admin');
update public.profiles set display_name = split_part(split_part(email, '-', 2), '@', 1) from auth.users u where u.id = profiles.id and u.email like 'fc-%';

create function pg_temp.coach(uid uuid, headline text, specialties text[], formats text[], city text, years int, langs text[], price bigint, live boolean)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', uid), true);
  perform public.save_coach_profile(headline, '', specialties, langs, formats, city, years, 10);
  perform public.save_package(null, 'Monthly', 'monthly', price, true);
  perform public.accept_coach_agreement(public.current_coach_agreement());
  if live then perform public.set_profile_live(true); end if;
end $$;

set local role authenticated;
select pg_temp.coach('a7100000-0000-0000-0000-0000000000a1', 'Boxing for beginners', array['Boxing','Beginners'], array['online','in_person'], 'Mumbai', 12, array['English','Hindi'], 450000, true);
select pg_temp.coach('a7200000-0000-0000-0000-0000000000a2', 'S&C for fighters', array['S&C','Strength'], array['online'], 'Bengaluru', 8, array['English'], 600000, true);
select pg_temp.coach('a7300000-0000-0000-0000-0000000000a3', 'Defence and ring craft', array['Boxing'], array['in_person'], 'Pune', 3, array['Marathi'], 350000, true);
select pg_temp.coach('a7400000-0000-0000-0000-0000000000a4', 'Draft coach', array['Boxing'], array['online'], 'Pune', 5, array['English'], 100000, false);
-- Ananya's credential is checked.
reset role;
insert into public.credentials (coach_id, title, file_path, status, decided_at) values ('a7200000-0000-0000-0000-0000000000a2', 'NSCA CSCS', 'a7200000-0000-0000-0000-0000000000a2/x.pdf', 'checked', now());
set local role anon;

select is((select count(*)::int from public.find_coaches()), 3, 'the directory lists live coaches only');
select is((select string_agg(name, ',' order by name) from public.find_coaches(specialty => 'boxing')), 'rohan,vikram', 'by specialty, any letter case');
select is((select string_agg(name, ',') from public.find_coaches(format => 'online', sort => 'price')), 'vikram,ananya', 'by format');
select is((select string_agg(name, ',') from public.find_coaches(city => 'pune')), 'rohan', 'by city');
select is((select string_agg(name, ',' order by name) from public.find_coaches(min_paise => 400000, max_paise => 500000)), 'vikram', 'by monthly price range');
select is((select string_agg(name, ',' order by name) from public.find_coaches(experience => '10+')), 'vikram', 'by experience band');
select is((select string_agg(name, ',') from public.find_coaches(checked_only => true)), 'ananya', 'credentials checked only');
select is((select string_agg(name, ',' order by name) from public.find_coaches(language => 'english')), 'ananya,vikram', 'by language');
select is((select count(*)::int from public.find_coaches(min_rating => 4)), 0, 'a rating filter matches nobody until there are verified reviews');
select is((select string_agg(name, ',') from public.find_coaches(sort => 'price')), 'rohan,vikram,ananya', 'price, low to high');
select is((select string_agg(name, ',') from public.find_coaches()), 'ananya,vikram,rohan', 'best match: checked credentials first, then experience');
select throws_ok($$ select * from public.find_coaches(sort => 'paid') $$, '22023', 'bad_sort', 'only the fixed sort keys exist');
select is((select from_paise::int from public.find_coaches(city => 'mumbai')), 450000, 'each card has the lowest live monthly price');

select * from finish();
rollback;
