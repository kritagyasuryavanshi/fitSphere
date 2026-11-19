'use client';

import { Button } from '@fitsphere/ui';
import { useState, useTransition } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { saveNote } from './actions';

export function NoteForm({ session, date, coach, initial }: { session: string; date: string; coach: string; initial: string }) {
  const hydrated = useHydrated();
  const [pending, start] = useTransition();
  const [note, setNote] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await saveNote(session, date, note);
          if ('error' in result) setMessage({ ok: false, text: result.error });
          else {
            setSaved(result.saved);
            setNote(result.saved);
            setMessage({ ok: true, text: result.saved ? `Saved. ${coach} sees your note with this session.` : 'Note removed.' });
          }
        });
      }}
    >
      <label className="flex flex-col gap-2 text-[15px] font-medium">
        A note for {coach}
        <textarea
          rows={4}
          maxLength={1000}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setMessage(null);
          }}
          className="resize-y border border-line-strong p-3 text-[15px] font-normal"
        />
      </label>
      <p role="status" className={`m-0 min-h-5 text-[14px] ${message?.ok === false ? 'font-medium text-danger' : 'text-success'}`}>
        {message?.text ?? ''}
      </p>
      <Button type="submit" variant="light" disabled={!hydrated || pending || note.trim() === saved} className="self-start">
        {pending ? 'Saving…' : 'Save note'}
      </Button>
    </form>
  );
}
