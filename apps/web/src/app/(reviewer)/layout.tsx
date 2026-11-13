import { CoachShell } from '@/components/layout/headers';

// Reviewers use the coach shell, which shows the Review queue link. Each page awaits requireRole('reviewer').
export default function ReviewerLayout({ children }: LayoutProps<'/'>) {
  return <CoachShell>{children}</CoachShell>;
}
