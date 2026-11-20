import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';
import { Refresher, SendForm } from './chat-client';

export const metadata: Metadata = { title: 'Messages · FitSphere' };

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

// X-Chat: one conversation. RLS returns it only to its two people.
async function Chat({ params }: PageProps<'/messages/[id]'>) {
  const viewer = await requireSignedIn();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await supabaseServer();
  const [list, msgs] = await Promise.all([
    supabase.rpc('my_conversations'),
    supabase.from('messages').select('id, sender_id, body, created_at').eq('conversation_id', id).order('id'),
  ]);
  if (list.error) throw list.error;
  if (msgs.error) throw msgs.error;
  const c = list.data.find((x) => x.conversation_id === id);
  if (!c) notFound();

  return (
    <>
      <Refresher />
      <div className="flex flex-col gap-1">
        <Link href="/messages" className="text-[15px] font-medium underline underline-offset-4">
          All messages
        </Link>
        <h1 className="m-0 text-[32px] font-semibold">
          {!c.i_am_coach && c.other_id ? <Link href={`/coaches/${c.other_id}`}>{c.other_name}</Link> : c.other_name}
        </h1>
      </div>
      <p role="note" className="m-0 border-l-4 border-warning bg-warning-soft p-3 text-[15px]">
        Keep payments on FitSphere. Paying outside means no refund protection and no verified review.
      </p>
      <ol aria-label="Messages" className="m-0 flex list-none flex-col gap-3 p-0">
        {msgs.data.map((m) => {
          const mine = m.sender_id === viewer.userId;
          return (
            <li key={m.id} className={`flex max-w-[85%] flex-col gap-1 p-3 ${mine ? 'self-end bg-ink text-paper' : 'self-start border border-line'}`}>
              <span className="sr-only">{mine ? 'You' : c.other_name}:</span>
              <span className="whitespace-pre-line text-[16px]">{m.body}</span>
              <span className={`text-[12px] ${mine ? 'text-paper/70' : 'text-muted'}`}>{when(m.created_at)}</span>
            </li>
          );
        })}
      </ol>
      {msgs.data.length ? null : <p className="m-0 text-[15px] text-muted">No messages yet.</p>}
      {c.other_id ? <SendForm conversationId={id} to={c.other_name} /> : <p className="m-0 text-[15px] text-muted">This person has left FitSphere.</p>}
    </>
  );
}

export default function ChatPage(props: PageProps<'/messages/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 pb-24 pt-8 md:px-10">
      <Suspense fallback={null}>
        <Chat {...props} />
      </Suspense>
    </main>
  );
}
