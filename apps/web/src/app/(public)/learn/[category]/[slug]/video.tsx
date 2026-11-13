'use client';

import { useState } from 'react';

/** YouTube through youtube-nocookie, loaded only on tap, so no YouTube request runs before the person asks. */
export function Video({ id, title }: { id: string; title: string }) {
  const [on, setOn] = useState(false);
  if (on) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
        title={`${title} video`}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full border-0 bg-ink"
      />
    );
  }
  return (
    <button type="button" onClick={() => setOn(true)} className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-ink text-paper">
      <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-volt text-[24px] text-ink">
        ▶
      </span>
      <span className="text-[16px] font-medium">Play the video</span>
      <span className="text-[13px] text-faint">Loads from YouTube when you tap</span>
    </button>
  );
}
