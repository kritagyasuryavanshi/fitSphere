import { buttonClass } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AI_LABEL } from '@/lib/ai/answer';
import { aiModel } from '@/lib/ai/model';
import { isUuid } from '@/lib/programs';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { addToToday } from './actions';
import { AskForm } from './ask-form';

export const metadata: Metadata = { title: 'Ask AI · FitSphere' };

type Stored = { text?: string; citations?: { id: string; title: string; href: string }[] };

// C-AI: the AI guide. Past questions, the chosen answer with its citations and Add to Today, and the question box.
// RLS shows each athlete only their own questions.
async function Ask({ searchParams }: PageProps<'/ask'>) {
  await requireRole('athlete');
  const { q, added } = await searchParams;
  const supabase = await supabaseServer();
  const [history, left, limit] = await Promise.all([
    supabase.from('ai_questions').select('id, question, kind, answer, created_at').neq('status', 'failed').order('created_at', { ascending: false }).limit(30),
    supabase.rpc('ai_questions_left'),
    supabase.rpc('ai_daily_limit'),
  ]);
  for (const r of [history, left, limit]) if (r.error) throw r.error;
  const chosen = history.data!.find((h) => h.id === (typeof q === 'string' && isUuid(q) ? q : undefined)) ?? history.data![0];
  const stored = (chosen?.answer ?? {}) as Stored;
  const citations = stored.citations ?? [];
  const on = aiModel() !== null;

  return (
    <div className="grid gap-8 md:grid-cols-[260px_1fr]">
      <nav aria-label="Past questions" className="order-2 md:order-1">
        <details open>
          <summary className="cursor-pointer text-[15px] font-semibold md:pointer-events-none md:list-none">Past questions</summary>
          {history.data!.length ? (
            <ul className="m-0 mt-2 flex list-none flex-col p-0">
              {history.data!.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/ask?q=${h.id}`}
                    aria-current={h.id === chosen?.id ? 'page' : undefined}
                    className={`block min-h-11 py-2 text-[15px] ${h.id === chosen?.id ? 'font-semibold' : 'text-ink-soft'}`}
                  >
                    {h.question}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 mt-2 text-[14px] text-muted">Your questions will show here.</p>
          )}
        </details>
      </nav>

      <div className="order-1 flex flex-col gap-6 md:order-2">
        <section aria-labelledby="how" className="border border-line p-4">
          <h2 id="how" className="m-0 text-[16px] font-semibold">
            How the AI guide works
          </h2>
          <p className="m-0 mt-1 text-[15px] text-ink-soft">
            It answers from coach-verified FitSphere lessons and links them. Anything without a library source is marked. It never diagnoses injuries.
          </p>
        </section>

        {chosen ? (
          <article aria-label="Answer" className="flex flex-col gap-3">
            <p className="m-0 self-end bg-ink p-3 text-[16px] text-paper">{chosen.question}</p>
            <p className="m-0 text-[13px] font-semibold uppercase tracking-wide text-muted">
              {chosen.kind === 'referral'
                ? 'Safety · no diagnosis'
                : chosen.kind === 'answer'
                  ? `${AI_LABEL} · based on ${citations.length} coach-verified ${citations.length === 1 ? 'lesson' : 'lessons'}`
                  : AI_LABEL}
            </p>
            <p className="m-0 whitespace-pre-line text-[16px]">{stored.text}</p>
            {chosen.kind === 'referral' ? <p className="m-0 text-[14px] text-muted">If you train in a coach&apos;s program, they can see that you reported pain.</p> : null}
            {citations.length ? (
              <section aria-labelledby="practise" className="flex flex-col gap-2 border-t border-line pt-3">
                <h2 id="practise" className="m-0 text-[16px] font-semibold">
                  Practise this
                </h2>
                <ul className="m-0 flex list-none flex-col p-0">
                  {citations.map((c) => (
                    <li key={c.id}>
                      <Link href={c.href} className="flex min-h-11 items-center text-[16px] font-medium underline underline-offset-4">
                        {c.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                <form action={addToToday}>
                  <input type="hidden" name="question" value={chosen.id} />
                  {citations.map((c) => (
                    <input key={c.id} type="hidden" name="item" value={c.id} />
                  ))}
                  <button type="submit" className={buttonClass({ variant: 'light', size: 'small' })}>
                    {citations.length === 1 ? 'Add to Today' : 'Add all to Today'}
                  </button>
                </form>
                {added ? (
                  <p role="status" className="m-0 text-[14px] text-success">
                    Added to <Link href="/today" className="underline underline-offset-4">Today</Link>.
                  </p>
                ) : null}
              </section>
            ) : null}
          </article>
        ) : null}

        {on ? <AskForm left={left.data ?? 0} limit={limit.data ?? 10} /> : <p className="m-0 text-[15px] text-muted">The AI guide is not switched on yet.</p>}
      </div>
    </div>
  );
}

export default function AskPage(props: PageProps<'/ask'>) {
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 pb-24 pt-8 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Ask AI</h1>
      <Suspense fallback={null}>
        <Ask {...props} />
      </Suspense>
    </main>
  );
}
