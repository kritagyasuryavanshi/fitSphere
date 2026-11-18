'use client';

import { Button, Input } from '@fitsphere/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { inviteCode } from '@/lib/invite-code';

/** Paste a coach's invite link (or just its code) and open the invite page. */
export function InviteLinkForm() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  return (
    <form
      noValidate
      className="flex w-full max-w-[560px] flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const code = inviteCode(value);
        if (!code) {
          setError('Paste the whole link your coach sent, like https://…/join/…');
          return;
        }
        router.push(`/join/${code}`);
      }}
    >
      <Input label="I have an invite link" name="link" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste the link here" error={error} />
      <Button type="submit" className="self-start">
        Open the invite
      </Button>
    </form>
  );
}
