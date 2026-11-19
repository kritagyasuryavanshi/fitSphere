// The session player is full screen and dark, without the app's header and tabs. Pages guard with requireRole.
export default function PlayerLayout({ children }: LayoutProps<'/'>) {
  return <div className="flex flex-1 flex-col bg-ink text-paper">{children}</div>;
}
