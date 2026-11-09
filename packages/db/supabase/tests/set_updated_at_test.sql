begin;

select plan(2);

select has_function('public', 'set_updated_at', 'the updated_at trigger function exists');

create table public.updated_at_probe (
  id int primary key,
  note text,
  updated_at timestamptz not null
);
create trigger set_updated_at before update on public.updated_at_probe
  for each row execute function public.set_updated_at();

insert into public.updated_at_probe values (1, 'first', '2000-01-01');
update public.updated_at_probe set note = 'second' where id = 1;

select isnt(
  (select updated_at from public.updated_at_probe where id = 1),
  '2000-01-01'::timestamptz,
  'an update moves updated_at forward'
);

select * from finish();

rollback;
