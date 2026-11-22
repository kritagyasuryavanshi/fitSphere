-- M4-14: verified reviews and coach replies. Only the athlete of coaching with a finished paid period reviews it, once.
-- Nobody edits or deletes a review; the coach replies once, in public. The rating is the average of visible reviews.
-- See docs/plans/m4-14-reviews.md.
begin;
select plan(51);

insert into auth.users (id, email, email_confirmed_at) values
  ('f7000000-0000-0000-0000-0000000000c1', 'rv-vikram@t.test', now()),
  ('f7000000-0000-0000-0000-0000000000c2', 'rv-leela@t.test', now()),
  ('f7000000-0000-0000-0000-0000000000a1', 'rv-kabir@t.test', now()),
  ('f7000000-0000-0000-0000-0000000000a2', 'rv-neha@t.test', now()),
  ('f7000000-0000-0000-0000-0000000000a3', 'rv-ravi@t.test', now()),
  ('f7000000-0000-0000-0000-0000000000a4', 'rv-isha@t.test', now()),
  ('f7000000-0000-0000-0000-0000000000a5', 'rv-arjun@t.test', now()),
  ('f7000000-0000-0000-0000-0000000000a6', 'rv-meera@t.test', now());
insert into public.user_roles (user_id, role) values ('f7000000-0000-0000-0000-0000000000c1', 'coach'), ('f7000000-0000-0000-0000-0000000000c2', 'coach');
update public.profiles set display_name = 'Vikram' where id = 'f7000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Kabir Singh' where id = 'f7000000-0000-0000-0000-0000000000a1';
update public.profiles set display_name = 'Isha' where id = 'f7000000-0000-0000-0000-0000000000a4';
update public.profiles set display_name = 'Meera Rao Iyer' where id = 'f7000000-0000-0000-0000-0000000000a6';
insert into public.coach_profiles (coach_id, headline, status, agreement_version) values
  ('f7000000-0000-0000-0000-0000000000c1', 'Boxing', 'live', public.current_coach_agreement()),
  ('f7000000-0000-0000-0000-0000000000c2', 'Strength', 'live', public.current_coach_agreement());

-- Kabir: a month paid and finished. Neha: in her first month. Ravi: refunded. Isha: a session yesterday. Arjun: only a
-- request. Meera: two months paid, the first finished.
insert into public.engagements (id, athlete_id, coach_id, package_title, package_kind, price_paise, fee_bps, start_date, days_per_week, status, share_data, paid_through) values
  ('f8000000-0000-0000-0000-0000000000e1', 'f7000000-0000-0000-0000-0000000000a1', 'f7000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 31, 3, 'ended', true, public.india_today() - 1),
  ('f8000000-0000-0000-0000-0000000000e2', 'f7000000-0000-0000-0000-0000000000a2', 'f7000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 3, 3, 'active', true, public.india_today() + 27),
  ('f8000000-0000-0000-0000-0000000000e3', 'f7000000-0000-0000-0000-0000000000a3', 'f7000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() - 40, 3, 'refunded', true, public.india_today() - 11),
  ('f8000000-0000-0000-0000-0000000000e4', 'f7000000-0000-0000-0000-0000000000a4', 'f7000000-0000-0000-0000-0000000000c1', 'Form check', 'single', 120000, 1500, public.india_today() - 1, 3, 'active', true, public.india_today() - 1),
  ('f8000000-0000-0000-0000-0000000000e5', 'f7000000-0000-0000-0000-0000000000a5', 'f7000000-0000-0000-0000-0000000000c1', 'Online coaching', 'monthly', 450000, 1500, public.india_today() + 2, 3, 'requested', true, null),
  ('f8000000-0000-0000-0000-0000000000e6', 'f7000000-0000-0000-0000-0000000000a6', 'f7000000-0000-0000-0000-0000000000c1', 'In-person coaching', 'monthly', 600000, 1500, public.india_today() - 40, 3, 'active', true, public.india_today() + 20);
insert into public.orders (engagement_id, amount_paise, fee_bps, kind, period_start, period_end, status, paid_at) values
  ('f8000000-0000-0000-0000-0000000000e1', 450000, 1500, 'first', public.india_today() - 31, public.india_today() - 1, 'paid', now() - interval '31 days'),
  ('f8000000-0000-0000-0000-0000000000e2', 450000, 1500, 'first', public.india_today() - 3, public.india_today() + 27, 'paid', now() - interval '3 days'),
  ('f8000000-0000-0000-0000-0000000000e3', 450000, 1500, 'first', public.india_today() - 40, public.india_today() - 11, 'refunded', now() - interval '40 days'),
  ('f8000000-0000-0000-0000-0000000000e4', 120000, 1500, 'first', public.india_today() - 1, public.india_today() - 1, 'paid', now() - interval '5 days'),
  ('f8000000-0000-0000-0000-0000000000e6', 600000, 1500, 'first', public.india_today() - 40, public.india_today() - 11, 'paid', now() - interval '40 days'),
  ('f8000000-0000-0000-0000-0000000000e6', 600000, 1500, 'renewal', public.india_today() - 10, public.india_today() + 20, 'paid', now() - interval '10 days');

create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- Who can review.
set local role authenticated;
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a1');
select ok(public.can_review('f8000000-0000-0000-0000-0000000000e1'), 'a month paid and finished can be reviewed');
select ok(not public.can_review('f8000000-0000-0000-0000-0000000000e4'), 'nobody reviews someone else''s coaching');
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a2');
select ok(not public.can_review('f8000000-0000-0000-0000-0000000000e2'), 'a first month not yet finished cannot');
select throws_ok($$ select public.post_review('f8000000-0000-0000-0000-0000000000e2', 5::smallint, 'Great') $$, '22023', 'not_eligible', 'and the review is refused');
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a3');
select ok(not public.can_review('f8000000-0000-0000-0000-0000000000e3'), 'refunded coaching cannot');
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a4');
select ok(public.can_review('f8000000-0000-0000-0000-0000000000e4'), 'a session that has happened can');
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a5');
select ok(not public.can_review('f8000000-0000-0000-0000-0000000000e5'), 'a request never paid cannot');
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a6');
select ok(public.can_review('f8000000-0000-0000-0000-0000000000e6'), 'running coaching with a finished paid month can');
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.post_review('f8000000-0000-0000-0000-0000000000e4', 5::smallint, 'Great') $$, '42501', 'not_yours', 'nobody posts on someone else''s coaching');
select throws_ok($$ select public.post_review('f8000000-0000-0000-0000-0000000000e1', 6::smallint, 'Great') $$, '22023', 'bad_rating', 'the rating is 1 to 5');
select throws_ok($$ select public.post_review('f8000000-0000-0000-0000-0000000000e1', 5::smallint, '   ') $$, '22023', 'bad_body', 'the text is required');
select throws_ok($$ select public.post_review('f8000000-0000-0000-0000-0000000000e1', 5::smallint, 'Great', 'superb') $$, '22023', 'bad_aspect', 'an aspect is excellent, good or okay');
reset role;
set local role anon;
select throws_ok($$ select public.post_review('f8000000-0000-0000-0000-0000000000e1', 5::smallint, 'Great') $$, '42501', null, 'a signed-out caller cannot review');
reset role;

-- Kabir reviews.
set local role authenticated;
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.post_review('f8000000-0000-0000-0000-0000000000e1', 5::smallint, '  He fixed my guard in the first week.  ', 'excellent', 'good', 'excellent') $$, 'Kabir reviews his coaching');
select throws_ok($$ select public.post_review('f8000000-0000-0000-0000-0000000000e1', 4::smallint, 'Again') $$, '22023', 'already_reviewed', 'once per engagement');
select ok(not public.can_review('f8000000-0000-0000-0000-0000000000e1'), 'and the form is not offered again');
select is((select row(rating, body, technique, feedback_speed, value_for_money)::text from public.reviews),
  row(5::smallint, 'He fixed my guard in the first week.', 'excellent', 'good', 'excellent')::text, 'he reads his own review, trimmed');
select throws_ok($$ update public.reviews set rating = 1 $$, '42501', null, 'he cannot edit it');
select throws_ok($$ delete from public.reviews $$, '42501', null, 'or delete it');
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000c1');
select throws_ok($$ update public.reviews set body = 'Bad coach' $$, '42501', null, 'the coach cannot edit it');
select throws_ok($$ delete from public.reviews $$, '42501', null, 'or delete it');
select is((select count(*)::int from public.reviews), 1, 'the coach reads reviews of their coaching');
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.reviews), 0, 'another athlete reads none directly');
reset role;
select is((select count(*)::int from public.notifications where user_id = 'f7000000-0000-0000-0000-0000000000c1' and kind = 'new_review'), 1, 'the coach is told');

-- The coach replies, once.
set local role authenticated;
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000c2');
select throws_ok($$ select public.reply_review((select id from public.coach_reviews('f7000000-0000-0000-0000-0000000000c1') limit 1), 'Thanks') $$, '42501', 'not_yours', 'another coach cannot reply');
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.reply_review((select id from public.reviews limit 1), 'Thanks') $$, '42501', 'not_yours', 'nor can the athlete');
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.reply_review((select id from public.reviews limit 1), '') $$, '22023', 'bad_reply', 'a reply has text');
select lives_ok($$ select public.reply_review((select id from public.reviews limit 1), 'Thank you, Kabir. Keep that guard up.') $$, 'the coach replies');
select throws_ok($$ select public.reply_review((select id from public.reviews limit 1), 'Edited') $$, '22023', 'already_replied', 'once, and it stays as written');
reset role;
select is((select count(*)::int from public.notifications where user_id = 'f7000000-0000-0000-0000-0000000000a1' and kind = 'review_reply'), 1, 'the athlete is told');

-- A refund on its way: no review until it is settled.
insert into public.payments (order_id, provider_payment_id, amount_paise, currency, status)
select o.id, 'pay_rv_isha', 120000, 'INR', 'captured' from public.orders o where o.engagement_id = 'f8000000-0000-0000-0000-0000000000e4';
insert into public.refunds (payment_id, amount_paise, reason) select id, 120000, 'admin' from public.payments where provider_payment_id = 'pay_rv_isha';
set local role authenticated;
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a4');
select ok(not public.can_review('f8000000-0000-0000-0000-0000000000e4'), 'coaching with a refund on its way cannot be reviewed');
reset role;
update public.refunds set status = 'failed' where payment_id = (select id from public.payments where provider_payment_id = 'pay_rv_isha');

-- Two more reviews, then the rating.
set local role authenticated;
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a4');
select lives_ok($$ select public.post_review('f8000000-0000-0000-0000-0000000000e4', 4::smallint, 'Clear notes.') $$, 'Isha reviews her session');
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a6');
select lives_ok($$ select public.post_review('f8000000-0000-0000-0000-0000000000e6', 2::smallint, 'Replies took two days.') $$, 'Meera reviews her coaching');
reset role;
set local role anon;
select is((select row(rating, review_count)::text from public.coach_rating('f7000000-0000-0000-0000-0000000000c1')), row(3.7, 3)::text, 'the rating is the average, to one decimal: (5 + 4 + 2) / 3');
select is((select row(rating, review_count)::text from public.find_coaches(ids => array['f7000000-0000-0000-0000-0000000000c1'::uuid])), row(3.7, 3)::text, 'the coach list shows the same');
select is((select count(*)::int from public.find_coaches(min_rating => 4, ids => array['f7000000-0000-0000-0000-0000000000c1'::uuid])), 0, 'and the rating filter uses it');
select is((select array_agg(author order by rating desc) from public.coach_reviews('f7000000-0000-0000-0000-0000000000c1')), array['Kabir S.', 'Isha', 'Meera I.'],
  'anyone reads the reviews, with first name and last initial');
select is((select row(package_title, months_paid, coach_reply is not null)::text from public.coach_reviews('f7000000-0000-0000-0000-0000000000c1') where author = 'Kabir S.'),
  row('Online coaching', 1, true)::text, 'each shows the package, the months paid and the reply');
select is((select months_paid from public.coach_reviews('f7000000-0000-0000-0000-0000000000c1') where author = 'Meera I.'), 2, 'renewed months count');
select is((select package_kind from public.coach_reviews('f7000000-0000-0000-0000-0000000000c1') where author = 'Isha'), 'single', 'a session review says it was a session');
select throws_ok($$ select * from public.reviews $$, '42501', null, 'a signed-out caller cannot read the table itself');
reset role;

-- An admin hides a review: it no longer shows or counts.
update public.reviews set hidden_at = now() where engagement_id = 'f8000000-0000-0000-0000-0000000000e6';
select is((select row(rating, review_count)::text from public.coach_rating('f7000000-0000-0000-0000-0000000000c1')), row(4.5, 2)::text, 'a hidden review does not count');
select is((select count(*)::int from public.coach_reviews('f7000000-0000-0000-0000-0000000000c1')), 2, 'or show');
set local role authenticated;
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000c1');
select is((select array_agg(author order by rating desc) from public.my_reviews()), array['Kabir S.', 'Isha', 'Meera I.'], 'the coach sees every review of theirs, hidden too, with names');
select throws_ok($$ select public.reply_review((select id from public.reviews where engagement_id = 'f8000000-0000-0000-0000-0000000000e6'), 'Sorry') $$, '22023', 'hidden', 'nobody replies to a hidden review');
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.my_reviews()), 0, 'my_reviews lists only the caller''s own coaching');
reset role;
-- Coaching refunded after its review: the review no longer shows or counts.
update public.engagements set status = 'refunded' where id = 'f8000000-0000-0000-0000-0000000000e4';
select is((select row(rating, review_count)::text from public.coach_rating('f7000000-0000-0000-0000-0000000000c1')), row(5.0, 1)::text, 'a review of refunded coaching does not count');
select is((select count(*)::int from public.coach_reviews('f7000000-0000-0000-0000-0000000000c1')), 1, 'or show');
update public.engagements set status = 'active' where id = 'f8000000-0000-0000-0000-0000000000e4';
-- A coach who is not live shows no rating.
update public.coach_profiles set status = 'draft' where coach_id = 'f7000000-0000-0000-0000-0000000000c1';
select is((select review_count from public.coach_rating('f7000000-0000-0000-0000-0000000000c1')), 0, 'a coach who is not live has no public rating');
update public.coach_profiles set status = 'live' where coach_id = 'f7000000-0000-0000-0000-0000000000c1';

-- The data download has the review; deleting the account deletes it.
set local role authenticated;
select pg_temp.as_user('f7000000-0000-0000-0000-0000000000a1');
select is(jsonb_array_length(public.export_my_data() -> 'reviews'), 1, 'the athlete''s data download has the review');
reset role;
delete from auth.users where id = 'f7000000-0000-0000-0000-0000000000a1';
select is((select row(rating, review_count)::text from public.coach_rating('f7000000-0000-0000-0000-0000000000c1')), row(4.0, 1)::text, 'a deleted account takes its review with it');

select * from finish();
rollback;
