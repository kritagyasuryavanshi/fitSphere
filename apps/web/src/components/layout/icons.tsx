// The line icons from the mockups, one set, chosen by name.
const paths = {
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="1" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  play: (
    <>
      <rect x="3" y="5" width="18" height="13" rx="1" />
      <path d="M10 9v5l4-2.5z" />
    </>
  ),
  bars: <path d="M5 20V12M12 20V5M19 20v-9" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevron: <path d="M9 5l7 7-7 7" />,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const bold = name === 'close' || name === 'chevron';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={bold ? 2.2 : 2} aria-hidden="true" className="flex-none">
      {paths[name]}
    </svg>
  );
}
