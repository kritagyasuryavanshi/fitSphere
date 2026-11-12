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

  const people = formData.getAll('person').map(String).filter((id) => UUID.test(id));
  const changed = people.flatMap((id) => {
    const before = String(formData.get(`before:${id}`) ?? '').split(',').filter(Boolean).sort();
    const after = formData.getAll(`roles:${id}`).map(String).filter((r): r is Role => ROLES.includes(r as Role)).sort();
    return before.join() === after.join() ? [] : [{ id, name: String(formData.get(`name:${id}`) ?? 'someone'), roles: after }];
  });
  if (!changed.length) return { message: 'Nothing to save.' };

  const errors: string[] = [];
  for (const person of changed) {
    const { error } = await supabase.rpc('admin_set_roles', { target: person.id, new_roles: person.roles });
    if (error) errors.push(error.code === '42501' ? `You cannot change the roles of ${person.name}.` : `Could not save ${person.name}. Try again.`);
  }
  revalidatePath('/admin/people');
  const saved = changed.length - errors.length;
  return { message: saved ? `Saved role changes for ${saved} ${saved === 1 ? 'person' : 'people'}.` : undefined, errors };
}
