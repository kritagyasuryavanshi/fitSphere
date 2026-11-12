import { PublicHeader } from '@/components/layout/headers';

export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <PublicHeader />
      <div className="flex-1">{children}</div>
    </>
  );
}
