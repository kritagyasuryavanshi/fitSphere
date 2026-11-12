import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '../../auth-shell';
import { signUpUser } from '../guard';
import { StepTwoForm } from './step-two-form';

export const metadata: Metadata = { title: 'Your training · FitSphere' };

async function Form() {
  const { supabase, userId, sports, answers } = await signUpUser();
  const [{ data: basics }, { data: consent }] = await Promise.all([
    supabase.from('athlete_basics').select('days_per_week, equipment, injury_notes').eq('user_id', userId).maybeSingle(),
    supabase
      .from('consents')
      .select('granted')
      .eq('user_id', userId)
      .eq('purpose', 'ai_health_personalisation')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const boxing = answers.boxing ?? {};
  const saved = {
    experience: String(boxing.experience ?? ''),
    wants: Array.isArray(boxing.wants) ? boxing.wants.map(String) : [],
    days: basics ? String(basics.days_per_week) : '',
    equipment: basics?.equipment ?? [],
    injuries: basics?.injury_notes ?? '',
    aiConsent: consent?.granted ?? false,
  };
  return <StepTwoForm boxing={sports.includes('boxing')} saved={saved} />;
}

export default function StepTwoPage() {
  return (
    <AuthShell
      back={{ href: '/welcome/1', label: 'Back' }}
      photo={{ src: '/images/gloves-red.jpg', alt: 'Pair of red boxing gloves' }}
      slogan="Let’s build your camp."
      step={{ now: 2, of: 4 }}
    >
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </AuthShell>
  );
}
