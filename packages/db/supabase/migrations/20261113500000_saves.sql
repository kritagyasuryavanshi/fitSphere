-- M2-06: save an item and mark it complete. Rows are personal; only these functions write them.
create table public.saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.content_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index saves_item_idx on public.saves (item_id);

create table public.completions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.content_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index completions_item_idx on public.completions (item_id);

-- The caller, once the item is published. Unpublished items cannot be saved or completed.
create function public.require_published(item uuid)
returns uuid
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
  if not exists (select 1 from public.content_items where id = item and status = 'published') then
    raise exception 'not_found' using errcode = '22023';
  end if;
  return uid;
end;
$$;

create function public.set_saved(item uuid, saved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_published(item);
begin
  if saved then
    insert into public.saves (user_id, item_id) values (uid, item) on conflict do nothing;
  else
    delete from public.saves where user_id = uid and item_id = item;
  end if;
end;
$$;

create function public.set_completed(item uuid, done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_published(item);
begin
  if done then
    insert into public.completions (user_id, item_id) values (uid, item) on conflict do nothing;
  else
    delete from public.completions where user_id = uid and item_id = item;
  end if;
end;
$$;

revoke all on public.saves, public.completions from anon, authenticated;
grant all on public.saves, public.completions to service_role;
grant select on public.saves, public.completions to authenticated;
revoke execute on function public.require_published(uuid), public.set_saved(uuid, boolean), public.set_completed(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_saved(uuid, boolean), public.set_completed(uuid, boolean) to authenticated;

alter table public.saves enable row level security;
alter table public.completions enable row level security;
create policy saves_select_own on public.saves for select to authenticated using (user_id = (select auth.uid()));
create policy completions_select_own on public.completions for select to authenticated using (user_id = (select auth.uid()));

-- The download includes saves and completions.
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
