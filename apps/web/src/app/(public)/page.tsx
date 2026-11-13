import { formatInr } from '@fitsphere/core';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';

async function SessionLine() {
  // The token check reads the clock, so mark this as request-time work first.
  await connection();
  const { data } = await (await supabaseServer()).auth.getClaims();
  const email = data?.claims.email;
  return email ? `Signed in as ${email}` : <Link href="/sign-in" className="underline">Log in or join</Link>;
}

// Temporary scaffold page. Replaced by the real landing page in board task M6-01.
export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-4xl font-semibold">FitSphere</h1>
      <p className="mt-4">App scaffold is running. Shared rules work: a monthly package costs {formatInr(450000)}.</p>
      <p className="mt-4">
        <Suspense fallback={null}>
          <SessionLine />
        </Suspense>
      </p>
    </main>
  );
}
