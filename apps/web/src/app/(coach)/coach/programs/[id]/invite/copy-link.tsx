'use client';

import { Button, buttonClass } from '@fitsphere/ui';
import { useState } from 'react';

export function CopyLink({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  const share = `https://wa.me/?text=${encodeURIComponent(`Join my program ${title} on FitSphere: ${url}`)}`;
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-2 text-[15px] font-medium">
        Invite link
        <input readOnly value={url} onFocus={(e) => e.target.select()} className="min-h-12 border border-line-strong bg-mist px-3 font-mono text-[14px] font-normal" />
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied('yes');
            } catch {
              setCopied('no');
            }
          }}
        >
          Copy link
        </Button>
        <a href={share} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: 'light' })}>
          Share on WhatsApp
        </a>
      </div>
      <p role="status" className="m-0 min-h-5 text-[14px] font-medium">
        {copied === 'yes' ? 'Link copied.' : copied === 'no' ? 'Could not copy. Select the link above and copy it.' : ''}
      </p>
    </div>
  );
}
