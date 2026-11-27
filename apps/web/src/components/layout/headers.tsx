import { buttonClass } from '@fitsphere/ui';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { aiModel } from '@/lib/ai/model';
import { athleteLinks as linksFor } from '@/lib/athlete-links';
import { getViewer, type Viewer } from '@/lib/viewer';
import { Icon } from './icons';
import { BottomTabs, HeaderLinks, type NavItem } from './nav-links';

// Header links per audience, from the mockups (C-Landing, C-Today, C-CoachDash, R-Roles, and the phone tab bars).
// Only pages that exist: Programs returns with the marketplace (M4).
const publicLinks: NavItem[] = [
  { href: '/learn', label: 'Learn' },
  { href: '/programs', label: 'Programs' },
  { href: '/coaches', label: 'Coaches' },
  { href: '/for-coaches', label: 'For coaches' },
];


// Each link shows only to the roles that can open it, so nobody is offered a page that says "not allowed".
function coachLinks(viewer: Viewer, desktop: boolean): NavItem[] {
  const links: NavItem[] = viewer.roles.includes('coach')
    ? [
        { href: '/coach', label: 'Athletes', icon: 'calendar', exact: true },
        { href: '/coach/programs', label: 'Programs', icon: 'bars' },
        { href: '/coach/lessons', label: desktop ? 'My lessons' : 'Lessons', icon: 'play' },
        { href: '/coach/clients', label: 'Clients', icon: 'calendar' },
        { href: '/coach/profile', label: desktop ? 'Marketplace profile' : 'Profile', icon: 'bars' },
      ]
    : [];
  // shortcut: the queue count arrives with the review queue (M2); the link shows only for reviewers.
  if (viewer.roles.includes('reviewer')) links.push({ href: '/review', label: desktop ? 'Review queue' : 'Review', icon: 'bars' });
  if (desktop && viewer.roles.includes('admin')) links.push({ href: '/admin/people', label: 'People' });
  if (desktop && viewer.roles.includes('admin')) links.push({ href: '/admin/credentials', label: 'Credential checks' });
  if (desktop && viewer.roles.includes('admin')) links.push({ href: '/admin/payouts', label: 'Payouts' });
  if (desktop && viewer.roles.includes('admin')) links.push({ href: '/admin/reports', label: 'Reports' });
  return links;
}

function Logo({ badge }: { badge?: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="font-display text-[24px] uppercase md:text-[28px]">FitSphere</span>
      {badge ? <span className="rounded-pill bg-volt px-2.5 py-1 text-[12px] font-semibold">{badge}</span> : null}
    </Link>
  );
}

function Frame({ label, logo, links, right }: { label: string; logo: ReactNode; links: ReactNode; right: ReactNode }) {
  return (
    <header className="border-b border-line bg-paper">
      <nav aria-label={label} className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-5 py-2 pl-4 pr-2 md:px-10">
        {logo}
        {links}
        <div className="flex items-center gap-1 md:gap-3">{right}</div>
      </nav>
    </header>
  );
}

function SearchLink() {
  return (
    <Link href="/search" aria-label="Search lessons and drills" className="flex size-11 items-center justify-center">
      <Icon name="search" />
    </Link>
  );
}

function Avatar({ viewer, label }: { viewer: Viewer; label: string }) {
  const initial = (viewer.name || viewer.email).trim().charAt(0).toUpperCase() || '?';
  return (
    <Link href="/account" aria-label={label} className="flex size-11 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-paper hover:text-paper">
      {initial}
    </Link>
  );
}

const avatarSlot = <span className="size-11" aria-hidden="true" />;

async function PublicRight() {
  const viewer = await getViewer();
  if (viewer) return <Avatar viewer={viewer} label={`${viewer.name || 'You'}, your account`} />;
  return (
    <>
      <Link href="/sign-in" className={`${buttonClass({ size: 'small' })} md:min-h-12 md:px-7 md:text-[16px]`}>
        <span className="md:hidden">Join</span>
        <span className="hidden md:inline">Join free</span>
      </Link>
      <Link href="/menu" aria-label="Menu" className="flex size-11 items-center justify-center md:hidden">
        <Icon name="menu" />
      </Link>
    </>
  );
}

/** Visitors: Learn, Coaches and For coaches; Join free; a menu on phones. */
export function PublicHeader() {
  return (
    <Frame
      label="Main"
      logo={<Logo />}
      links={<HeaderLinks items={publicLinks} />}
      right={
        <>
          <SearchLink />
          <Suspense fallback={avatarSlot}>
            <PublicRight />
          </Suspense>
        </>
      }
    />
  );
}

async function AthleteAvatar() {
  const viewer = await getViewer();
  if (!viewer) return avatarSlot;
  return (
    <>
      {/* Coaches who also train get a way back to their coach tools. */}
      {viewer.roles.includes('coach') ? (
        <Link href="/coach" className="px-1 text-[14px] font-medium underline underline-offset-4">
          Coach tools
        </Link>
      ) : null}
      <Avatar viewer={viewer} label={`${viewer.name || 'You'}, your account`} />
    </>
  );
}

/** Athletes: Today, Learn and Progress. Phones get the same links as bottom tabs. */
export function AthleteShell({ children }: { children: ReactNode }) {
  const athleteLinks = linksFor(aiModel() !== null);
  return (
    <>
      <Frame
        label="App"
        logo={<Logo />}
        links={<HeaderLinks items={athleteLinks} />}
        right={
          <>
            <span className="md:hidden">
              <SearchLink />
            </span>
            <Suspense fallback={avatarSlot}>
              <AthleteAvatar />
            </Suspense>
          </>
        }
      />
      <div className="flex-1">{children}</div>
      <BottomTabs items={athleteLinks} label="App" />
    </>
  );
}

async function CoachNav({ part }: { part: 'links' | 'right' | 'tabs' }) {
  const viewer = await getViewer();
  // Someone without the role sees no coach links while the page guard redirects them.
  if (!viewer || !viewer.roles.some((r) => r === 'coach' || r === 'admin')) return null;
  if (part === 'links') return <HeaderLinks items={coachLinks(viewer, true)} />;
  if (part === 'tabs') return <BottomTabs items={coachLinks(viewer, false)} label="Coach" />;
  const admin = viewer.roles.includes('admin');
  // A coach who also trains gets "Train" on every screen size; other admins get the athlete site on desktop.
  return (
    <>
      {viewer.roles.includes('athlete') ? (
        <Link href="/today" className="px-1 text-[14px] font-medium underline underline-offset-4">
          Train
        </Link>
      ) : admin ? (
        <Link href="/learn" className="hidden text-[14px] font-medium underline underline-offset-4 md:inline">
          Athlete site
        </Link>
      ) : null}
      <Avatar viewer={viewer} label={admin ? 'Admin account' : 'Your account'} />
    </>
  );
}

/** Coaches and admins: Athletes, Programs, My lessons, the review queue for reviewers, People for admins. */
export function CoachShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Frame
        label="Coach"
        logo={<Logo badge="Coach" />}
        links={
          <Suspense fallback={null}>
            <CoachNav part="links" />
          </Suspense>
        }
        right={
          <Suspense fallback={avatarSlot}>
            <CoachNav part="right" />
          </Suspense>
        }
      />
      <div className="flex-1">{children}</div>
      <Suspense fallback={null}>
        <CoachNav part="tabs" />
      </Suspense>
    </>
  );
}
