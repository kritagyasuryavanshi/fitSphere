-- M1-02: create the profile and athlete role when the email is confirmed, not when the auth user is created.
-- An email-link sign-in creates the auth user before the link is clicked, so anyone could type a stranger's address.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is null then
    return new;
  end if;
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80))
  on conflict (id) do nothing;
  -- Only a new profile gets the role, so confirming again never undoes a suspension.
  if found then
    insert into public.user_roles (user_id, role) values (new.id, 'athlete');
  end if;
  return new;
end;
$$;

drop trigger on_auth_user_created on auth.users;
create trigger on_auth_user_confirmed after insert or update of email_confirmed_at on auth.users
  for each row execute function public.handle_new_user();
