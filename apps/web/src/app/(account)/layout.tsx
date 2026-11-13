import { PublicHeader } from '@/components/layout/headers';

// Account pages serve every signed-in person, whatever their roles, so they use the public header.
// Each page, action and route here awaits requireSignedIn itself (guards.test.ts checks).
export default function AccountLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <PublicHeader />
      <div className="flex-1">{children}</div>
    </>
  );
}
