'use server';

import { revalidatePath } from 'next/cache';
import { stopSubscriptions } from '@/lib/payments/reconcile';
import { after } from 'next/server';
import { sendQueuedEmails } from '@/lib/email-send';
import { requireRole, type Role } from '@/lib/viewer';
import { supabaseServer } from '@/lib/supabase/server';

export type SaveRolesState = { message?: string; errors?: string[] };

const ROLES: Role[] = ['athlete', 'coach', 'reviewer', 'admin'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Saves every changed row. The form sends each person's roles before and after, and only changed people are written.
 * The database decides who may change what: admin_set_roles checks the admin, blocks self-changes, and audits each change.
 */
export async function saveRoles(_prev: SaveRolesState, formData: FormData): Promise<SaveRolesState> {
  await requireRole('admin');
  const supabase = await supabaseServer();

  // The page lists at most 200 people, so a bigger form is forged.
  const people = formData.getAll('person').map(String).filter((id) => UUID.test(id)).slice(0, 200);
  const roles = (values: string[]) => values.filter((r): r is Role => ROLES.includes(r as Role)).sort();
  const changed = people.flatMap((id) => {
    const before = roles(String(formData.get(`before:${id}`) ?? '').split(','));
    const after = roles(formData.getAll(`roles:${id}`).map(String));
    return before.join() === after.join() ? [] : [{ id, name: String(formData.get(`name:${id}`) ?? 'someone'), before, after }];
  });
  if (!changed.length) return { message: 'Nothing to save.' };

  const errors: string[] = [];
  for (const person of changed) {
    // The roles this page showed go along, so the database refuses the save if another admin changed them since.
    const { error } = await supabase.rpc('admin_set_roles', { target: person.id, new_roles: person.after, expected_roles: person.before });
    if (!error) continue;
    if (error.message === 'roles_changed') errors.push(`The roles of ${person.name} changed since you opened this page. The list now shows them; check and save again.`);
    else if (error.message === 'roles_required') errors.push(`Pick at least one role for ${person.name}.`);
    else if (error.code === '42501') errors.push(`You cannot change the roles of ${person.name}.`);
    else errors.push(`Could not save ${person.name}. Try again.`);
  }
  // A coach who lost the role had their renewals stopped (stop_coach_renewals); cancel at the provider now, rather
  // than at the next daily run, so no renewal slips through. The daily cron retries what fails here.
  if (changed.some((p) => p.before.includes('coach') && !p.after.includes('coach'))) {
    await stopSubscriptions().catch((e) => console.error('stopping subscriptions after a role change failed', e));
  }
  revalidatePath('/admin/people');
  const saved = changed.length - errors.length;
  return { message: saved ? `Saved role changes for ${saved} ${saved === 1 ? 'person' : 'people'}.` : undefined, errors };
}

/** Make coach or Decline on one application. The database grants the role, audits it and queues the email. */
export async function decideApplication(formData: FormData): Promise<void> {
  await requireRole('admin');
  const id = String(formData.get('application') ?? '');
  const decision = String(formData.get('decision') ?? '');
  if (!UUID.test(id) || !['approve', 'decline'].includes(decision)) return;
  const { error } = await (await supabaseServer()).rpc('decide_coach_application', { application: id, approve: decision === 'approve' });
  // Another admin may have decided first; the list then shows that, so it is not an error here.
  if (error && error.message !== 'already_decided') throw new Error(`Could not save the decision: ${error.message}`);
  revalidatePath('/admin/people');
  // The decision email is queued with it; send it after the response, as feedback does.
  after(async () => {
    try {
      await sendQueuedEmails();
    } catch (e) {
      console.error('sending queued emails failed', e);
    }
  });
}
