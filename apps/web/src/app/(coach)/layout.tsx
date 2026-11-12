import { CoachShell } from '@/components/layout/headers';

// Draws the coach shell only. Each page checks the role itself with requireRole, because layouts do not re-run on navigation.
export default function CoachLayout({ children }: LayoutProps<'/'>) {
  return <CoachShell>{children}</CoachShell>;
}
