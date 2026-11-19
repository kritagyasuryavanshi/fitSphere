import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';
import { EmailSwitch } from './email-switch';
import { ReplyForm } from './reply-form';

export const metadata: Metadata = { title: 'Coach feedback · FitSphere' };

const stamp = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

// T-Feedback: every piece of feedback the athlete has had, also from programs they left, with their replies.
async function Feedback() {
  const viewer = await requireSignedIn();
  const supabase = await supabaseServer();
  const [{ data, error }, programs, prefs] = await Promise.all([
    supabase
      .from('feedback')
      .select('id, body, created_at, program_id, coach_name, program_title, feedback_replies(id, body, created_at)')
      .eq('athlete_id', viewer.userId)
      .order('created_at', { ascending: false }),
    supabase.rpc('my_programs'),
    supabase.rpc('my_email_prefs'),
  ]);
  if (error) throw error;
  if (programs.error) throw programs.error;
  if (prefs.error) throw prefs.error;
  const emailSwitch = <EmailSwitch kind="coach_feedback" label="Email me when my coach sends feedback" initial={prefs.data[0]?.coach_feedback ?? true} />;
  // Replies reach the coach only while the athlete is still in that program.
  const active = new Set(programs.data.map((p) => p.program_id));
  if (!data.length) {
    return (
      <>
      {emailSwitch}
      <div className="flex flex-col items-start gap-3 bg-mist p-8">
        <p className="m-0 text-[18px] font-medium">No feedback yet</p>
        <p className="m-0 text-[16px] text-muted">When your coach sends feedback on your training, it shows here and on Today.</p>
      </div>
      </>
    );
  }
  return (
    <>
    {emailSwitch}
    <ul aria-label="Coach feedback" className="m-0 flex list-none flex-col gap-6 p-0">
      {data.map((f) => {
        const coach = f.coach_name || 'Your coach';
        return (
          <li key={f.id} className="flex flex-col gap-3 border border-line p-5">
            <p className="m-0 text-[14px] text-muted">
              <span className="font-medium text-ink">{coach}</span>
              {f.program_title ? ` · ${f.program_title}` : ''} · {stamp.format(new Date(f.created_at))}
            </p>
            <p className="m-0 whitespace-pre-line text-[16px]">{f.body}</p>
            {[...f.feedback_replies]
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .map((r) => (
                <p key={r.id} className="m-0 ml-4 whitespace-pre-line border-l-2 border-line pl-3 text-[15px] text-ink-soft">
                  <span className="block text-[13px] text-muted">You · {stamp.format(new Date(r.created_at))}</span>
                  {r.body}
                </p>
              ))}
            {f.program_id && active.has(f.program_id) ? (
              <ReplyForm feedback={f.id} coach={coach} />
            ) : (
              <p className="m-0 text-[14px] text-muted">You are no longer in this program, so replies are closed.</p>
            )}
          </li>
        );
      })}
    </ul>
    </>
  );
}

export default function FeedbackPage() {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <Link href="/account" className="self-start text-[14px] font-medium underline underline-offset-4">
        Account
      </Link>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Coach feedback</h1>
      <Suspense fallback={null}>
        <Feedback />
      </Suspense>
      <p className="m-0 text-[14px] text-muted">For pain or injury, see a doctor or physiotherapist first.</p>
    </main>
  );
}
