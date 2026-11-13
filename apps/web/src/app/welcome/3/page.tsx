import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AuthShell } from '../../auth-shell';
import { signUpUser } from '../guard';
import { consentValue } from '../options';
import { StepThreeForm } from './step-three-form';

export const metadata: Metadata = { title: 'Your gym goal · FitSphere' };

async function Form() {
  const { supabase, userId, sports, answers, stepTwoDone } = await signUpUser();
  // Only people who chose Gym & Fitness see this step. Others reach it only by Back from step 4, so go back once more.
  if (!stepTwoDone || !sports.includes('gym')) redirect('/welcome/2');
  const [{ data: metric }, { data: consent }] = await Promise.all([
    supabase.from('body_metrics').select('weight_kg, height_cm').eq('user_id', userId).order('measured_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('consents').select('granted').eq('user_id', userId).eq('purpose', 'ai_body_metrics').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const gym = answers.gym ?? {};
  const saved = {
    goal: String(gym.goal ?? ''),
    place: String(gym.place ?? ''),
    lifting: String(gym.lifting ?? ''),
    weight: metric?.weight_kg != null ? String(metric.weight_kg) : '',
    height: metric?.height_cm != null ? String(metric.height_cm) : '',
    aiConsent: consentValue(consent?.granted),
  };
  // Keyed on the saved answers: Next keeps a visited step mounted, and a reused radio ignores a new defaultChecked.
  return <StepThreeForm key={JSON.stringify(saved)} saved={saved} />;
}

export default function StepThreePage() {
  return (
    <AuthShell
      back={{ href: '/welcome/2', label: 'Back' }}
      photo={{ src: '/images/squat-bw.jpg', alt: 'Woman with a barbell on her back' }}
      slogan="Train with a reason."
      step={{ now: 3, of: 4 }}
    >
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </AuthShell>
  );
}
