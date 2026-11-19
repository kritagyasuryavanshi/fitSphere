-- M3-09: done summaries. finish_session takes the time the player was opened, so the summary's time covers the
-- whole session and not only from the first save; the athlete's note to the coach saves on the session log.

drop function public.finish_session(uuid, date);

-- finish_session as in 20261121000000_session_logs.sql, plus opened_at. A client value only ever moves the start
-- earlier, and no further back than six hours, so a wrong clock cannot make a session days long.
create function public.finish_session(session uuid, on_date date, opened_at timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  log uuid;
begin
  if not exists (select 1 from public.scheduled_session(session, on_date)) then
    raise exception 'not_scheduled' using errcode = '22023';
  end if;
  select l.id into log from public.session_logs l
  where l.athlete_id = auth.uid() and l.session_id = session and l.on_date = finish_session.on_date
    and exists (select 1 from public.item_logs i where i.log_id = l.id)
  for update;
  if log is null then
    raise exception 'nothing_logged' using errcode = '22023';
  end if;
  update public.session_logs
  set completed_at = coalesce(completed_at, now()),
    started_at = least(started_at, greatest(coalesce(opened_at, started_at), now() - interval '6 hours'))
  where id = log;
  return log;
end;
$$;

-- The athlete's note to their coach on a session they finished. Only the athlete writes it; the coach reads it
-- under the session log's policy. Leading and trailing whitespace of any kind (spaces, new lines, tabs) is dropped,
-- as String.trim does in the app.
create function public.save_session_note(session uuid, on_date date, note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  log uuid;
  body text := regexp_replace(coalesce(note, ''), '^\s+|\s+$', '', 'g');
begin
  if char_length(body) > 1000 then
    raise exception 'bad_note' using errcode = '22023';
  end if;
  update public.session_logs l set note = body
  where l.athlete_id = auth.uid() and l.session_id = session and l.on_date = save_session_note.on_date
    and l.completed_at is not null
  returning l.id into log;
  if log is null then
    raise exception 'no_log' using errcode = 'P0002';
  end if;
  return log;
end;
$$;

revoke execute on function public.finish_session(uuid, date, timestamptz), public.save_session_note(uuid, date, text) from public, anon;
grant execute on function public.finish_session(uuid, date, timestamptz), public.save_session_note(uuid, date, text) to authenticated;
