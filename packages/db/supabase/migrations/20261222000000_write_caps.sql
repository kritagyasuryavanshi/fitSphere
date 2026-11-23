-- M6-07: caps on spammy writes. Each capped table counts the signed-in person's rows in a window before an insert.
-- The trigger sits on the table, so every path (an RPC, a server action, a direct insert) is capped. The service
-- role, used by crons and admin tools, is never capped. Sign-in rate limits come from Supabase Auth (M6-11).
-- shortcut: count-then-insert can let two parallel inserts both pass at the edge; fine for spam, not for money.

create function public.cap_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  col text := tg_argv[0];
  most int := tg_argv[1]::int;
  win interval := tg_argv[2]::interval;
  who uuid := (to_jsonb(new) ->> col)::uuid;
  n int;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'authenticated' or who is null then
    return new;
  end if;
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2', tg_table_schema, tg_table_name, col)
    into n using who, win;
  if n >= most then
    raise exception 'rate_limited' using errcode = '22023', hint = format('%s: at most %s per %s', tg_table_name, most, win);
  end if;
  return new;
end;
$$;
revoke all on function public.cap_writes() from public, anon, authenticated;

-- Limits sit well above real use: a coach chatting with many clients, an athlete trying several coaches.
create trigger write_cap before insert on public.messages for each row execute function public.cap_writes('sender_id', '60', '10 minutes');
create trigger write_cap before insert on public.engagements for each row execute function public.cap_writes('athlete_id', '10', '1 day');
create trigger write_cap before insert on public.feedback for each row execute function public.cap_writes('coach_id', '200', '1 hour');
create trigger write_cap before insert on public.feedback_replies for each row execute function public.cap_writes('feedback_id', '20', '1 day');
create trigger write_cap before insert on public.content_items for each row execute function public.cap_writes('author_id', '20', '1 day');
create trigger write_cap before insert on public.credentials for each row execute function public.cap_writes('coach_id', '20', '1 day');
create trigger write_cap before insert on public.shortlists for each row execute function public.cap_writes('athlete_id', '100', '1 day');
create trigger write_cap before insert on public.refunds for each row execute function public.cap_writes('requested_by', '10', '1 day');

-- The message count reads by sender and time.
create index messages_sender_created_idx on public.messages (sender_id, created_at);
