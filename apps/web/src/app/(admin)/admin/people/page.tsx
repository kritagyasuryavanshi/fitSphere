import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Icon } from '@/components/layout/icons';
import { supabaseServer } from '@/lib/supabase/server';
import { requireRole } from '@/lib/viewer';
import { PeopleTable } from './people-table';

export const metadata: Metadata = { title: 'People · FitSphere Admin' };

const joined = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

async function People({ searchParams }: { searchParams: PageProps<'/admin/people'>['searchParams'] }) {
  const viewer = await requireRole('admin');
  const { q } = await searchParams;
  const search = typeof q === 'string' ? q.slice(0, 100) : '';
  const { data, error } = await (await supabaseServer()).rpc('admin_list_people', { search });
  if (error) throw new Error(`Could not list people: ${error.message}`);

  const people = (data ?? []).map((p) => ({
    id: p.id,
    name: p.display_name,
    email: p.email,
    roles: p.roles,
    joined: joined.format(new Date(p.joined)),
    self: p.id === viewer.userId,
  }));

  return (
    <>
      <form role="search" className="flex max-w-[420px] items-center gap-2 border border-line-strong px-3.5 focus-within:outline-2 focus-within:outline-ink">
        <Icon name="search" size={20} />
        <label htmlFor="people-search" className="sr-only">
          Search people
        </label>
        <input
          id="people-search"
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Search by name or email"
          className="min-h-12 w-full bg-transparent text-[16px] outline-none"
        />
      </form>
      <PeopleTable people={people} />
    </>
  );
}

// R-Roles. Coach applications (M1-07), credential checks and reports (M4) join this page later.
export default function PeoplePage({ searchParams }: PageProps<'/admin/people'>) {
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-10 md:px-10">
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95] md:text-[64px]">People</h1>
      <p className="m-0 text-[16px] text-ink-soft">Only admins grant the coach or reviewer role. Every change is logged.</p>
      <h2 className="m-0 text-[22px] font-medium">Everyone</h2>
      <Suspense fallback={null}>
        <People searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
