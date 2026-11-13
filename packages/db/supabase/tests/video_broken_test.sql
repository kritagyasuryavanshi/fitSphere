-- M2-10: the broken flag clears when the video link changes.
begin;
select plan(2);
update public.content_items set video_id = 'dQw4w9WgXcQ' where slug = 'jab';
update public.content_items set video_broken = true where slug = 'jab';
update public.content_items set summary = 'Changed.' where slug = 'jab';
select is((select video_broken from public.content_items where slug = 'jab'), true, 'other edits keep the flag');
update public.content_items set video_id = 'aaaaaaaaaaa' where slug = 'jab';
select is((select video_broken from public.content_items where slug = 'jab'), false, 'a new link clears it');
select * from finish();
rollback;
