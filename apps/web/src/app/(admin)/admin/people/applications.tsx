import { Button } from '@fitsphere/ui';
import { supabaseServer } from '@/lib/supabase/server';
import { decideApplication } from './actions';

// Shows where a link really goes: "https://fitsphere.app@evil.example" reads as evil.example here.
function host(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** R-Roles, "Coach applications". The list comes from an admin-only function that adds the account email. */
export async function Applications({ viewerId }: { viewerId: string }) {
  const { data: apps, error } = await (await supabaseServer()).rpc('admin_list_applications');
  if (error) throw new Error(`Could not list applications: ${error.message}`);

  return (
    <section aria-labelledby="apps" className="flex flex-col gap-3">
      <h2 id="apps" className="m-0 text-[22px] font-medium">
        Coach applications · {apps?.length ?? 0}
      </h2>
      {apps?.length ? null : <p className="m-0 text-[15px] text-muted">No applications waiting.</p>}
      {apps?.map((app) => (
        <article key={app.id} aria-label={`Application from ${app.full_name}`} className="flex flex-col justify-between gap-4 border border-line-strong p-4 md:flex-row">
          <div className="flex flex-col gap-1">
            <p className="m-0 text-[16px] font-medium">
              {app.full_name} <span className="text-[14px] font-normal text-muted">· {app.email}</span>
            </p>
            <p className="m-0 text-[14px] text-muted">
              {app.sport} · {app.city} · {app.years_coaching} years coaching, self-reported
            </p>
            {app.how_today ? <p className="m-0 text-[15px] text-ink-soft">“{app.how_today}”</p> : null}
          </div>
          <form action={decideApplication} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="application" value={app.id} />
            {app.work_url ? (
              // The database keeps only http(s) links; rel stops the opened page from reaching back.
              <a href={app.work_url} target="_blank" rel="noopener noreferrer nofollow" className="text-[14px] font-medium underline">
                Their work on {host(app.work_url)}
              </a>
            ) : null}
            {/* Nobody grants themselves a role; another admin decides an admin's own application. */}
            {app.user_id === viewerId ? (
              <span className="text-[14px] text-muted">Your own application: another admin decides it.</span>
            ) : (
              <>
                <Button type="submit" name="decision" value="approve" size="small">
                  Make coach
                </Button>
                <Button type="submit" name="decision" value="decline" variant="light" size="small">
                  Decline
                </Button>
              </>
            )}
          </form>
        </article>
      ))}
    </section>
  );
}
