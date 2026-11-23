import { PublicHeader } from '@/components/layout/headers';
import { PublicFooter } from '@/components/layout/public-footer';

export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <PublicHeader />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </>
  );
}
