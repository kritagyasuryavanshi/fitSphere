-- M2-10: the broken flag clears when the video link changes.
begin;
select plan(4);
update public.content_items set video_id = 'dQw4w9WgXcQ' where slug = 'jab';
update public.content_items set video_broken = true where slug = 'jab';
update public.content_items set summary = 'Changed.' where slug = 'jab';
select is((select video_broken from public.content_items where slug = 'jab'), true, 'other edits keep the flag');
update public.content_items set video_id = 'aaaaaaaaaaa' where slug = 'jab';
select is((select video_broken from public.content_items where slug = 'jab'), false, 'a new link clears it');
update public.content_items set updated_at = '2026-01-01' where slug = 'stance';
update public.content_items set video_checked_at = now(), video_broken = true where slug = 'stance';
select is((select updated_at from public.content_items where slug = 'stance'), '2026-01-01'::timestamptz, 'the daily check does not count as an edit');
update public.content_items set title = 'Stance!' where slug = 'stance';
select isnt((select updated_at from public.content_items where slug = 'stance'), '2026-01-01'::timestamptz, 'a real edit still moves updated_at');
select * from finish();
rollback;
