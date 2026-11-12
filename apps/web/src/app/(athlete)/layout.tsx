import { AthleteShell } from '@/components/layout/headers';

// Draws the athlete shell only. Each page checks the role itself with requireRole, because layouts do not re-run on navigation.
export default function AthleteLayout({ children }: LayoutProps<'/'>) {
  return <AthleteShell>{children}</AthleteShell>;
}
