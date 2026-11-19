import { Button, Tag } from '@fitsphere/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { requireSignedIn } from '@/lib/viewer';
import { EmailSwitch } from '../feedback/email-switch';
import { markAllRead } from './actions';

export const metadata: Metadata = { title: 'Notifications · FitSphere' };

const stamp = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

// M3-16: the caller's notifications (RLS returns only their own), newest first, with the email switch per event.
async function Notifications() {
  await requireSignedIn();
  const supabase = await supabaseServer();
  const [list, prefs, unreadCount] = await Promise.all([
    // shortcut: the newest 50 only; add paging once someone has more.
    supabase.from('notifications').select('id, kind, title, body, link, created_at, read_at').order('created_at', { ascending: false }).limit(50),
    supabase.rpc('my_email_prefs'),
    // Counted over all of them, as Mark all as read marks all of them, not only the 50 shown.
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
  ]);
  if (list.error) throw list.error;
  if (prefs.error) throw prefs.error;
  if (unreadCount.error) throw unreadCount.error;
  const p = prefs.data[0];
  const unread = unreadCount.count ?? 0;
  return (
    <>
      {list.data.length ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-[15px] text-muted">{unread ? `${unread} unread` : 'All read'}</p>
            {unread ? (
              <form action={markAllRead}>
                <Button type="submit" variant="light">
                  Mark all as read
                </Button>
              </form>
            ) : null}
          </div>
          <ul aria-label="Notifications" className="m-0 flex list-none flex-col border-t border-line p-0">
            {list.data.map((n) => (
              <li key={n.id} className="flex flex-col gap-1 border-b border-line py-3">
                <span className="flex flex-wrap items-center gap-2">
                  {n.read_at ? null : <Tag variant="success">New</Tag>}
                  {/* Only paths inside the site: never //host or /\host, which browsers treat as another site. */}
                  {/^\/(?![/\\])/.test(n.link) ? (
                    <Link href={n.link} className={`text-[16px] underline-offset-4 hover:underline ${n.read_at ? '' : 'font-semibold'}`}>
                      {n.title}
                    </Link>
                  ) : (
                    <span className={`text-[16px] ${n.read_at ? '' : 'font-semibold'}`}>{n.title}</span>
                  )}
                </span>
                {n.body ? <span className="text-[15px] text-ink-soft">{n.body}</span> : null}
                <span className="text-[13px] text-muted">{stamp.format(new Date(n.created_at))}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="flex flex-col items-start gap-3 bg-mist p-8">
          <p className="m-0 text-[18px] font-medium">No notifications yet</p>
          <p className="m-0 text-[16px] text-muted">Feedback from your coach, new lessons and today&rsquo;s session show up here.</p>
        </div>
      )}
      <section aria-labelledby="emails" className="flex flex-col gap-1 border-t border-line pt-5">
        <h2 id="emails" className="m-0 mb-2 text-[20px] font-semibold">
          Email me about
        </h2>
        <EmailSwitch kind="coach_feedback" label="Feedback from my coach" initial={p?.coach_feedback ?? true} />
        <EmailSwitch kind="new_lesson" label="New lessons from my coach" initial={p?.new_lesson ?? true} />
        <EmailSwitch kind="session_reminder" label="A reminder on days I have a session" initial={p?.session_reminder ?? false} />
      </section>
    </>
  );
}

export default function NotificationsPage() {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-20 pt-8 md:px-10">
      <Link href="/account" className="self-start text-[14px] font-medium underline underline-offset-4">
        Account
      </Link>
      <h1 className="m-0 font-display text-[48px] font-normal uppercase leading-[0.95]">Notifications</h1>
      <Suspense fallback={null}>
        <Notifications />
      </Suspense>
    </main>
  );
}
