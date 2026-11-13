-- M2-10: a new video link clears the broken flag; the next daily check sets it again if needed.
create function public.reset_video_broken()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.video_id is distinct from old.video_id then
    new.video_broken := false;
  end if;
  return new;
end;
$$;
create trigger content_items_reset_video_broken before update of video_id on public.content_items
  for each row execute function public.reset_video_broken();
revoke execute on function public.reset_video_broken() from public, anon, authenticated;
