'use server';

import { revalidatePath } from 'next/cache';
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
  revalidatePath('/admin/people');
  const saved = changed.length - errors.length;
  return { message: saved ? `Saved role changes for ${saved} ${saved === 1 ? 'person' : 'people'}.` : undefined, errors };
}
