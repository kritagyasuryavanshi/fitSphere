/** The 11-character video id from a YouTube link or a bare id; null for anything else. */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, '');
  const id =
    host === 'youtu.be' ? url.pathname.slice(1) : host === 'youtube.com' ? (url.searchParams.get('v') ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1]) : null;
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export type DraftChecks = {
  videoId: string | null;
  steps: string[];
  mistakes: string;
  safety: string;
  needsSupports: boolean;
  supports: string[];
  needsMuscles: boolean;
  muscles: string[];
};

/** What Submit needs. The same rules run again in submit_content, so a forged form cannot skip them. */
export function readiness(d: DraftChecks) {
  // shortcut: checks the link is a YouTube id, not that the video is public; M2-10 flags broken videos daily.
  const checks = [
    { label: 'Public video linked', done: !!d.videoId },
    { label: 'At least 3 steps', done: d.steps.filter((s) => s.trim()).length >= 3 },
    { label: 'Common mistakes', done: !!d.mistakes.trim() },
    { label: 'Safety guidance', done: !!d.safety.trim() },
  ];
  if (d.needsSupports) checks.push({ label: 'The boxing skill it builds', done: d.supports.length > 0 });
  if (d.needsMuscles) checks.push({ label: 'Muscles it works', done: d.muscles.length > 0 });
  return { checks, ready: checks.every((c) => c.done) };
}
