import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { AuthShell } from '../../auth-shell';
import { AboutYouForm } from './about-you-form';

export const metadata: Metadata = { title: 'About you · FitSphere' };

// Reads the session, so it streams in at request time behind Suspense.
async function Form() {
  await connection();
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect('/sign-in');

  const [{ data: sports }, { data: profile }, { data: prefs }] = await Promise.all([
    supabase.from('categories').select('id, name, tagline, is_live').order('sort'),
    supabase.from('profiles').select('display_name, date_of_birth').eq('id', userId).maybeSingle(),
    supabase.from('athlete_prefs').select('category_id').eq('user_id', userId),
  ]);
  const [year = '', month = '', day = ''] = profile?.date_of_birth?.split('-') ?? [];
  const saved = { name: profile?.display_name ?? '', day, month, year, sports: prefs?.map((p) => p.category_id) ?? [] };
  // Keyed on the saved answers: Next keeps a visited step mounted, and a reused radio ignores a new defaultChecked.
  return <AboutYouForm key={JSON.stringify(saved)} sports={sports ?? []} saved={saved} />;
}

export default function AboutYouPage() {
  return (
    <AuthShell
      back={{ href: '/sign-in', label: 'Back' }}
      slogan="Let’s build your plan."
      step={{ now: 1, of: 4 }}
    >
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </AuthShell>
  );
}
