import { CoachShell } from '@/components/layout/headers';

// Admins work in the coach shell with an extra People link (R-Roles). Each page checks the role itself with requireRole.
export default function AdminLayout({ children }: LayoutProps<'/'>) {
  return <CoachShell>{children}</CoachShell>;
}
