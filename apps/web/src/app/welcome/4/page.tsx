import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthShell } from '../../auth-shell';
import { signUpUser } from '../guard';
import { boxingExperience, gymGoals, gymPlaces, labelOf } from '../options';

export const metadata: Metadata = { title: 'You’re in · FitSphere' };

async function Summary() {
  const { supabase, userId, name, sports, answers } = await signUpUser();
  const [{ data: categories }, { data: basics }, { data: consent }] = await Promise.all([
    supabase.from('categories').select('id, name').order('sort'),
    supabase.from('athlete_basics').select('days_per_week').eq('user_id', userId).maybeSingle(),
    supabase
      .from('consents')
      .select('granted')
      .eq('user_id', userId)
      .eq('purpose', 'ai_health_personalisation')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows: [string, string][] = [['Training', (categories ?? []).filter((c) => sports.includes(c.id)).map((c) => c.name).join(', ')]];
  if (answers.gym?.goal) rows.push(['Gym goal', `${labelOf(gymGoals, answers.gym.goal)}, ${labelOf(gymPlaces, answers.gym.place).toLowerCase()}`]);
  if (answers.boxing?.experience) rows.push(['Experience', labelOf(boxingExperience, answers.boxing.experience)]);
  if (basics) rows.push(['Days a week', String(basics.days_per_week)]);
  rows.push(['Injury notes for AI', consent?.granted ? 'Shared' : 'Not shared']);

  return (
    <>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px] md:leading-[0.9]">You’re in, {name}</h1>
      <dl className="m-0 border-t border-line">
        {rows.map(([term, value]) => (
          <div key={term} className="flex justify-between gap-4 border-b border-line py-3 text-[15px]">
            <dt className="text-muted">{term}</dt>
            <dd className="m-0 text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <Link href="/welcome/1" className="self-start text-[15px] font-medium underline">
        Change answers
      </Link>
      <h2 className="m-0 mt-4 text-[20px] font-medium">How do you want to start?</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {/* shortcut: invites arrive in M3 and Today in M2; until then both cards go home. */}
        {[
          ['I have a coach’s invite link', 'Join their program'],
          ['Start on my own', 'Lessons and drills, no coach yet'],
        ].map(([title, hint]) => (
          <Link key={title} href="/" className="flex flex-col gap-1 border border-line-strong p-4 hover:border-ink">
            <span className="text-[16px] font-medium">{title}</span>
            <span className="text-[14px] text-muted">{hint}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

export default function ReadyPage() {
  return (
    <AuthShell
      back={{ href: '/welcome/3', label: 'Back' }}
      photo={{ src: '/images/heavybag.jpg', alt: 'Boxers training on heavy bags' }}
      slogan="Camp is open."
      step={{ now: 4, of: 4 }}
    >
      <Suspense fallback={null}>
        <Summary />
      </Suspense>
    </AuthShell>
  );
}
