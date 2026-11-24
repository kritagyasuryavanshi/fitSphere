# FitSphere runbook

What to do when something goes wrong. Written for the owner, at a PC, with no developer present.
Production: Vercel project `fitsphere`, Supabase project `mxrwjhdqglozdxsgtjgw` (Mumbai).

Backups and the daily job check run in the private repo `fitsphere-ops` (workflow copy: `docs/ops/ops.yml`).

## A daily job failed
GitHub emails you "Ops: health failed".
1. The health check answers only ok or not ok. To see which job, run in the Supabase SQL editor: `select * from public.job_runs;`
2. Open Vercel → fitsphere → Logs, and filter by `/api/cron/send-emails` or `/api/cron/check-videos`. Read the error.
3. Run the job again by hand: Vercel → Settings → Cron Jobs → Run.
4. Run the Ops workflow again with `health`. It must pass.

## A backup failed
GitHub emails you "Ops: backup failed".
- "Secrets are set" failed: add `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE` and `CRON_SECRET` in the `fitsphere-ops` repo → Settings → Secrets → Actions.
- "Restore … and compare" failed: the dump does not restore. Treat it as urgent, because there is no good backup this week.

## Restore from a backup
1. Download the newest `fitsphere-backup-*` artifact from the `fitsphere-ops` repo → Actions → Ops.
2. Decrypt it: `gpg -d fitsphere-backup.tar.gz.gpg | tar -xz`. Use the passphrase from your password manager.
3. Restore into a new Supabase project, never over production:
   `psql --single-transaction -v ON_ERROR_STOP=1 -f roles.sql -f schema.sql -c 'set session_replication_role = replica' -f data.sql "<new project URL>"`.
4. Check the counts, then point Vercel at the new project.
Supabase also keeps 7 days of daily backups on the free plan: Dashboard → Database → Backups.

## A data breach
- **Now:** CERT-In's directions require a report of a cyber incident within 6 hours of noticing it (incident@cert-in.org.in).
- **From May 2027,** when the DPDP Rules' breach duties start: also tell each affected person and the Data Protection Board of India without delay, with the full report within 72 hours.
1. **Contain, in the first hour.** Rotate every key below. If one account is the cause, suspend it from /admin/people.
2. **Find out.** What data, whose, from when to when, and how. Keep the Vercel and Supabase logs. Do not delete anything.
3. **Tell people.** Email each affected person: what happened, what data, what it means for them, what we did, and who to contact.
4. **Tell the authorities.** CERT-In within 6 hours. From May 2027, also the Data Protection Board.
5. **Write it down.** Add a `bug-*` note in `docs/memory/` with the timeline and the fix.

## Rotate a key
Rotate a key at once if it appeared in a chat, a log, a screenshot or a commit. Change it at the provider first, then in Vercel (Settings → Environment Variables), then redeploy.

| Key | Where it is made | Where it is used |
|---|---|---|
| `SUPABASE_SECRET_KEY` | Supabase → Settings → API keys | Vercel |
| Database password (in `SUPABASE_DB_URL`) | Supabase → Settings → Database | `fitsphere-ops` repo secret `SUPABASE_DB_URL` |
| `CRON_SECRET` | Any long random string | Vercel, and the `fitsphere-ops` repo secret |
| `SMTP_PASS` (with `SMTP_USER`, the Gmail address) | Google Account → Security → App passwords | Vercel, and Supabase → Authentication → SMTP |
| `RESEND_API_KEY` | Resend → API keys | Vercel |
| `ANTHROPIC_API_KEY` / Gemini key | Anthropic console / Google AI Studio | Vercel, local `.env.local` |
| `PAYMENTS_WEBHOOK_SECRET` | Razorpay → Webhooks | Vercel |
| `BACKUP_PASSPHRASE` | Your password manager | `fitsphere-ops` repo secret. Old backups keep the old passphrase, so keep it too. |
| GitHub token | GitHub → Settings → Developer settings | Local `gh` login |

After a rotation, check that the site loads, sign-in works and the Ops health run passes.
