-- S0-08: the one usage number (decision-m6-launch cut usage analytics): distinct athletes who completed a
-- session, per India week starting Monday, for the last N weeks (1 to 52). Admins only; counts, never names.
create function public.admin_weekly_training(weeks int default 8)
returns table (week_start date, athletes int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
  with w as (
    select (date_trunc('week', public.india_today()::timestamp)::date - 7 * g)::date as week_start
    from generate_series(0, least(greatest(weeks, 1), 52) - 1) g
  )
  select w.week_start, count(distinct l.athlete_id)::int
  from w
  left join public.session_logs l on l.completed_at is not null and l.on_date >= w.week_start and l.on_date < w.week_start + 7
  group by w.week_start
  order by w.week_start;
end;
$$;
revoke all on function public.admin_weekly_training(int) from public, anon;
grant execute on function public.admin_weekly_training(int) to authenticated;
