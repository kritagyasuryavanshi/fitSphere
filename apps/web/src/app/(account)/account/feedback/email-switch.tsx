'use client';

import { Checkbox } from '@fitsphere/ui';
import { useState, useTransition } from 'react';
import { useHydrated } from '@/lib/use-hydrated';
import { setFeedbackEmails } from './actions';

export function EmailSwitch({ initial }: { initial: boolean }) {
  const hydrated = useHydrated();
  const [on, setOn] = useState(initial);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <Checkbox
        label="Email me when my coach sends feedback"
        checked={on}
        disabled={!hydrated || pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            const r = await setFeedbackEmails(next);
            if (r.error) {
              setOn(!next);
              setError(r.error);
            } else setError('');
          });
        }}
      />
      <p role="status" className="m-0 min-h-5 text-[14px] font-medium text-danger">
        {error}
      </p>
    </div>
  );
}
