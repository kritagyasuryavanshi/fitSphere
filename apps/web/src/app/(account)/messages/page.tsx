import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Messages · FitSphere' };

async function Conversations() {
  await requireSignedIn();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('my_conversations');
  if (error) throw error;
  if (!data.length) return <p className="m-0 text-[16px]">No messages yet. You can message a coach once you send them a request.</p>;
  return (
    <ul className="m-0 flex list-none flex-col border-t border-line p-0">
      {data.map((c) => (
        <li key={c.conversation_id} className="border-b border-line">
          <Link href={`/messages/${c.conversation_id}`} className="flex min-h-14 items-center justify-between gap-3 py-3 text-[17px] font-medium">
            <span>
              {c.other_name}
              <span className="text-[14px] font-normal text-muted"> · {c.i_am_coach ? 'your client' : 'your coach'}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function MessagesPage() {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 pb-24 pt-8 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Messages</h1>
      <Suspense fallback={null}>
        <Conversations />
      </Suspense>
    </main>
  );
}
