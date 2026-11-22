-- Audit fix: export_my_data as in 20261217000000_reviews.sql, plus the person's money records: payments with
-- their refunds and subscription for an athlete, payouts for a coach.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'email', (select email from auth.users where id = uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'roles', coalesce((select jsonb_agg(r.role order by r.role) from public.user_roles r where r.user_id = uid), '[]'),
    'sports', coalesce((select jsonb_agg(jsonb_build_object('sport', a.category_id, 'answers', a.answers)) from public.athlete_prefs a where a.user_id = uid), '[]'),
    'training', (select to_jsonb(b) - 'user_id' from public.athlete_basics b where b.user_id = uid),
    'body_metrics', coalesce((select jsonb_agg(to_jsonb(m) - 'user_id' order by m.measured_at) from public.body_metrics m where m.user_id = uid), '[]'),
    'consents', coalesce((select jsonb_agg(to_jsonb(c) - 'user_id' order by c.created_at) from public.consents c where c.user_id = uid), '[]'),
    'coach_applications', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' - 'decided_by' order by x.created_at) from public.coach_applications x where x.user_id = uid), '[]'),
    'saved', coalesce((select jsonb_agg(jsonb_build_object('item', c.slug, 'at', s.created_at) order by s.created_at)
      from public.saves s join public.content_items c on c.id = s.item_id where s.user_id = uid), '[]'),
    'completed', coalesce((select jsonb_agg(jsonb_build_object('item', c.slug, 'at', s.created_at) order by s.created_at)
      from public.completions s join public.content_items c on c.id = s.item_id where s.user_id = uid), '[]'),
    'programs', coalesce((select jsonb_agg(jsonb_build_object('program', coalesce((select v.title from public.program_versions v where v.id = public.version_in_effect(p.id, public.india_today())), ''), 'status', e.status, 'start_date', e.start_date,
        'joined_at', e.joined_at, 'ended_at', e.ended_at) order by e.joined_at)
      from public.enrollments e join public.programs p on p.id = e.program_id where e.athlete_id = uid), '[]'),
    'training_logs', coalesce((select jsonb_agg(to_jsonb(l) - 'athlete_id' || jsonb_build_object('items',
        coalesce((select jsonb_agg(to_jsonb(i) - 'log_id' || jsonb_build_object('sets',
            coalesce((select jsonb_agg(to_jsonb(x) - 'item_log_id' order by x.set_no) from public.set_logs x where x.item_log_id = i.id), '[]'))
          order by i.position) from public.item_logs i where i.log_id = l.id), '[]'))
        order by l.on_date, l.started_at)
      from public.session_logs l where l.athlete_id = uid), '[]'),
    'feedback', coalesce((select jsonb_agg(jsonb_build_object('at', f.created_at, 'coach', f.coach_name, 'program', f.program_title, 'body', f.body,
        'replies', coalesce((select jsonb_agg(jsonb_build_object('at', r.created_at, 'body', r.body) order by r.created_at) from public.feedback_replies r where r.feedback_id = f.id), '[]'))
        order by f.created_at)
      from public.feedback f where f.athlete_id = uid), '[]'),
    'email_prefs', (select to_jsonb(p) - 'user_id' from public.email_prefs p where p.user_id = uid),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'title', n.title, 'body', n.body, 'at', n.created_at, 'read_at', n.read_at) order by n.created_at)
      from public.notifications n where n.user_id = uid), '[]'),
    'coach', (select to_jsonb(cp) - 'coach_id' - 'payout_account_id' || jsonb_build_object(
        'packages', coalesce((select jsonb_agg(to_jsonb(p) - 'coach_id' order by p.created_at) from public.packages p where p.coach_id = uid), '[]'),
        'slots', coalesce((select jsonb_agg(to_jsonb(a) - 'coach_id' - 'id' order by a.dow, a.start_time) from public.availability_slots a where a.coach_id = uid), '[]'),
        'credentials', coalesce((select jsonb_agg(to_jsonb(c) - 'coach_id' - 'decided_by' order by c.created_at) from public.credentials c where c.coach_id = uid), '[]'))
      from public.coach_profiles cp where cp.coach_id = uid),
    'coaching', coalesce((select jsonb_agg(jsonb_build_object('coach', coalesce(nullif(p.display_name, ''), 'Coach'), 'package', g.package_title,
        'price_paise', g.price_paise, 'start_date', g.start_date, 'days_per_week', g.days_per_week, 'goals', g.goals, 'share_data', g.share_data,
        'status', g.status, 'requested_at', g.created_at, 'decided_at', g.decided_at, 'ended_at', g.ended_at,
        'cancel_reason', (select r.reason from public.cancel_reasons r where r.engagement_id = g.id)) order by g.created_at)
      from public.engagements g left join public.profiles p on p.id = g.coach_id where g.athlete_id = uid), '[]'),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('conversation', c.id,
        'from', case when m.sender_id = uid then 'You' else coalesce(nullif(p.display_name, ''), case when c.coach_id = m.sender_id then 'Coach' else 'Athlete' end) end,
        'body', m.body, 'at', m.created_at) order by c.id, m.id)
      from public.messages m join public.conversations c on c.id = m.conversation_id
      left join public.profiles p on p.id = m.sender_id
      where c.athlete_id = uid or c.coach_id = uid), '[]'),
    'ai_questions', coalesce((select jsonb_agg(jsonb_build_object('asked_on', q.asked_on, 'question', q.question, 'answer', q.answer ->> 'text',
        'kind', q.kind, 'at', q.created_at) order by q.created_at)
      from public.ai_questions q where q.user_id = uid), '[]'),
    'pain_reports', coalesce((select jsonb_agg(jsonb_build_object('on', p.reported_on, 'source', p.source) order by p.created_at)
      from public.pain_reports p where p.athlete_id = uid), '[]'),
    'added_to_today', coalesce((select jsonb_agg(jsonb_build_object('on', t.on_date, 'item', c.slug) order by t.created_at)
      from public.today_extras t join public.content_items c on c.id = t.item_id where t.athlete_id = uid), '[]'),
    'shortlist', coalesce((select jsonb_agg(jsonb_build_object('coach', s.coach_id, 'at', s.created_at) order by s.created_at)
      from public.shortlists s where s.athlete_id = uid), '[]'),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('package', g.package_title, 'rating', r.rating, 'technique', r.technique,
        'feedback_speed', r.feedback_speed, 'value_for_money', r.value_for_money, 'body', r.body, 'at', r.created_at,
        'coach_reply', r.coach_reply) order by r.created_at)
      from public.reviews r join public.engagements g on g.id = r.engagement_id where r.athlete_id = uid), '[]'),
    'review_replies', coalesce((select jsonb_agg(jsonb_build_object('reply', r.coach_reply, 'at', r.replied_at) order by r.replied_at)
      from public.reviews r where r.coach_id = uid and r.coach_reply is not null), '[]'),
    -- Money: each payment with its refunds and the subscription; the refund note and who asked stay out (admin only).
    'payments', coalesce((select jsonb_agg(jsonb_build_object('package', g.package_title, 'kind', o.kind, 'amount_paise', o.amount_paise,
        'currency', o.currency, 'period_start', o.period_start, 'period_end', o.period_end, 'status', o.status,
        'created_at', o.created_at, 'paid_at', o.paid_at,
        'subscription_status', (select s.status from public.subscriptions s where s.engagement_id = g.id order by s.created_at desc limit 1),
        'refunds', coalesce((select jsonb_agg(jsonb_build_object('amount_paise', r.amount_paise, 'reason', r.reason, 'status', r.status,
            'at', r.created_at, 'processed_at', r.processed_at) order by r.created_at)
          from public.payments p join public.refunds r on r.payment_id = p.id where p.order_id = o.id), '[]'))
        order by o.created_at)
      from public.orders o join public.engagements g on g.id = o.engagement_id where g.athlete_id = uid), '[]'),
    'payouts', coalesce((select jsonb_agg(jsonb_build_object('gross_paise', x.gross_paise, 'fee_paise', x.fee_paise, 'net_paise', x.net_paise,
        'status', x.status, 'hold_until', x.hold_until, 'at', x.created_at) order by x.created_at)
      from public.payouts x where x.coach_id = uid), '[]'),
    'account_created_at', (select created_at from auth.users where id = uid),
    'last_sign_in_at', (select last_sign_in_at from auth.users where id = uid),
    'queued_emails', coalesce((select jsonb_agg(jsonb_build_object('to', o.to_email, 'template', o.template, 'data', o.data, 'created_at', o.created_at, 'sent_at', o.sent_at) order by o.id)
      from public.email_outbox o where o.user_id = uid or lower(o.to_email) = lower((select email from auth.users where id = uid))), '[]'),
    -- Role changes about the person, by action and time; the other party shows only as an id.
    'audit_events', coalesce((select jsonb_agg(jsonb_build_object('action', l.action, 'details', l.details, 'at', l.created_at) order by l.id)
      from public.audit_log l where l.target_id = uid), '[]')
  );
end;
$$;
