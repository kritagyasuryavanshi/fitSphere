-- M2-10: the daily check takes the videos checked longest ago first, so a large library rotates through.
alter table public.content_items add column video_checked_at timestamptz;
create index content_items_video_checked_idx on public.content_items (video_checked_at nulls first) where video_id is not null;

-- The daily check writes video_checked_at and video_broken; those are not edits, so updated_at stays.
drop trigger content_items_set_updated_at on public.content_items;
create trigger content_items_set_updated_at before update of
  discipline_id, author_id, kind, slug, title, summary, level, duration_min, equipment, environments, drill_type,
  supports, video_id, mistakes, safety, dose, is_sample, status, review_note, reviewed_by, published_at
  on public.content_items for each row execute function public.set_updated_at();
