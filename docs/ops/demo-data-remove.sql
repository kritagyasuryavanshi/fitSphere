-- Removes the demo coach from docs/ops/demo-data.sql, with everything that hangs off the account.
-- Run: npx supabase db query --remote -f ../../docs/ops/demo-data-remove.sql   (from packages/db)
begin;
delete from public.programs where coach_id = 'd0000000-0000-4000-8000-00000000c0a1';
delete from auth.users where id = 'd0000000-0000-4000-8000-00000000c0a1';
commit;
