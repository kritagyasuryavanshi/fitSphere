import { buttonClass } from '@fitsphere/ui';
import Link from 'next/link';
import { connection } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';
import { toggleProgress } from './actions';

/** Save and Mark complete. Guests see one link that asks them to sign in first. */
export async function Progress({ itemId, path }: { itemId: string; path: string }) {
  // The session check reads the clock, so this part renders per request.
  await connection();
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <Link href="/sign-in" className={`${buttonClass({ variant: 'light' })} self-start`}>
        Log in to save and track this
      </Link>
    );
  }
  const supabase = await supabaseServer();
  const [{ data: saved }, { data: done }] = await Promise.all([
    supabase.from('saves').select('item_id').eq('item_id', itemId).maybeSingle(),
    supabase.from('completions').select('item_id').eq('item_id', itemId).maybeSingle(),
  ]);
  const button = (what: 'saved' | 'completed', on: boolean, label: string, variant: 'ink' | 'light') => (
    <form action={toggleProgress}>
      <input type="hidden" name="item" value={itemId} />
      <input type="hidden" name="what" value={what} />
      <input type="hidden" name="on" value={on ? 'no' : 'yes'} />
      <input type="hidden" name="path" value={path} />
      <button type="submit" aria-pressed={on} className={buttonClass({ variant })}>
        {label}
      </button>
    </form>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {button('completed', !!done, done ? 'Completed ✓' : 'Mark complete', done ? 'light' : 'ink')}
      {button('saved', !!saved, saved ? 'Saved' : 'Save', 'light')}
    </div>
  );
}
