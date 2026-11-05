import { formatInr } from '@fitsphere/core';

// Temporary scaffold page. Replaced by the real landing page in board task M6-01.
export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-4xl font-semibold">FitSphere</h1>
      <p className="mt-4">App scaffold is running. Shared rules work: a monthly package costs {formatInr(450000)}.</p>
    </main>
  );
}
