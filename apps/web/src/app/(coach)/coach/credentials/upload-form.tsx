'use client';

import { Button, Input } from '@fitsphere/ui';
import { useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useHydrated } from '@/lib/use-hydrated';
import { ensureCoachProfile, submitCredential } from './actions';

const TYPES: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_BYTES = 10 * 1024 * 1024;

// The file goes straight from the browser into the coach's own folder of the private bucket (Storage RLS checks it),
// because Vercel limits a server request to about 4.5 MB. The server action then records the credential.
export function UploadForm({ userId }: { userId: string }) {
  const hydrated = useHydrated();
  const form = useRef<HTMLFormElement>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <form
      ref={form}
      aria-label="Add a credential"
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const file = data.get('file');
        const title = String(data.get('title') ?? '').trim();
        setDone('');
        if (!title) return setError('Give the credential a title.');
        if (!(file instanceof File) || !file.size) return setError('Choose the certificate file.');
        const ext = TYPES[file.type];
        if (!ext) return setError('Upload a PDF, JPG or PNG.');
        if (file.size > MAX_BYTES) return setError('The file is over 10 MB. Upload a smaller scan.');
        setError('');
        setPending(true);
        const bucket = supabaseBrowser().storage.from('credentials');
        let uploaded: string | null = null;
        try {
          const ready = await ensureCoachProfile();
          if (ready.error) return setError(ready.error);
          const path = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
          const up = await bucket.upload(path, file, { contentType: file.type });
          if (up.error) return setError('The upload failed. Check your connection and try again.');
          uploaded = path;
          const saved = await submitCredential({ title, issuer: String(data.get('issuer') ?? '').trim(), idNumber: String(data.get('idNumber') ?? '').trim(), path });
          if (saved.error) throw new Error(saved.error);
          uploaded = null;
          form.current?.reset();
          setDone(`Sent for checking: ${title}.`);
        } catch (err) {
          // A network drop or an expired session: say so, and do not leave an orphan file behind.
          if (uploaded) await bucket.remove([uploaded]).catch(() => {});
          setError(err instanceof Error && err.message.length < 120 ? err.message : 'Something went wrong. Check your connection and try again.');
        } finally {
          setPending(false);
        }
      }}
    >
      <Input label="Title" name="title" maxLength={120} placeholder="For example, AIBA level 1 coach" />
      <Input label="Issuer" name="issuer" maxLength={120} placeholder="The body that issued it" />
      <Input label="Certificate or membership number (optional)" name="idNumber" maxLength={60} />
      <label className="flex flex-col gap-2 text-[15px] font-medium">
        Certificate file (PDF, JPG or PNG, up to 10 MB)
        <input type="file" name="file" accept="application/pdf,image/jpeg,image/png" className="text-[15px] font-normal" />
      </label>
      <p role="status" className={`m-0 min-h-5 text-[14px] ${error ? 'font-medium text-danger' : 'text-success'}`}>
        {error || done}
      </p>
      <Button type="submit" disabled={!hydrated || pending} className="self-start">
        {pending ? 'Uploading…' : 'Send for checking'}
      </Button>
    </form>
  );
}
