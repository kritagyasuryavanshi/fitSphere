-- M3-11: the body weight log on the progress page. Optional; one weight per India day, the latest entry that day
-- replaces the earlier one. The athlete reads their own (body_metrics_select_own); their current coach reads it
-- through coach_can_read, which ends the moment the last enrollment with that coach ends.
create function public.log_body_weight(weight_kg numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_step1();
  today_row uuid;
begin
  if weight_kg is null or weight_kg < 20 or weight_kg > 400 or weight_kg <> round(weight_kg, 1) then
    raise exception 'bad_weight' using errcode = '22023';
  end if;
  select id into today_row from public.body_metrics
  where user_id = uid and (measured_at at time zone 'Asia/Kolkata')::date = public.india_today()
  order by measured_at desc limit 1 for update;
  if today_row is null then
    insert into public.body_metrics (user_id, weight_kg) values (uid, weight_kg) returning id into today_row;
  else
    update public.body_metrics set weight_kg = log_body_weight.weight_kg, measured_at = clock_timestamp() where id = today_row;
  end if;
  return today_row;
end;
$$;
revoke execute on function public.log_body_weight(numeric) from public, anon;
grant execute on function public.log_body_weight(numeric) to authenticated;

create policy body_metrics_select_coach on public.body_metrics for select to authenticated using (public.coach_can_read(user_id));
