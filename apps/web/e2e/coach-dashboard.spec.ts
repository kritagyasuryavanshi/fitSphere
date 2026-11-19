import { expect, test } from '@playwright/test';
import { admin, coachWithProgram, createUser, signInWithEmail } from './helpers';

const india = (offsetDays = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + offsetDays * 86_400_000));

test.describe('Coach dashboard', () => {
  test('shows only the coach own active athletes, their logged sessions and flags', async ({ page }) => {
    const drill = (day: number) => ({ day, title: `Day ${day}`, items: [{ slug: 'skipping', type: 'time' as const, prescription: { seconds: 300 } }] });
    const { coach, programId } = await coachWithProgram(`Ring Basics ${Date.now()}`, { sessions: [drill(1), drill(2), drill(3)] });
    const other = await coachWithProgram(`Other Camp ${Date.now()}`, { coachName: 'Ananya', sessions: [drill(1)] });
    const db = admin();

    // Neha logs hard; Ravi started 6 days ago and missed days 1 to 3; Sana is in another coach's program.
    const neha = await createUser(['athlete'], { name: 'Neha' });
    const ravi = await createUser(['athlete'], { name: 'Ravi' });
    const sana = await createUser(['athlete'], { name: 'Sana' });
    const enrol = async (athlete: string, program: string, start: string) =>
      expect((await db.from('enrollments').insert({ athlete_id: athlete, program_id: program, start_date: start })).error).toBeNull();
    await enrol(neha.id, programId, india(-1));
    await enrol(ravi.id, programId, india(-6));
    await enrol(sana.id, other.programId, india());

    const { data: sessions } = await db
      .from('program_sessions')
      .select('id, day, program_versions!inner(program_id, version)')
      .eq('program_versions.program_id', programId)
      .eq('program_versions.version', 1)
      .order('day');
    const finish = async (athlete: string, day: number, onDate: string, effort: number, note: string) => {
      const { data: log, error } = await db
        .from('session_logs')
        .insert({ athlete_id: athlete, program_id: programId, session_id: sessions![day - 1]!.id, on_date: onDate, category_id: 'boxing', title: `Day ${day}`, completed_at: new Date().toISOString(), note })
        .select('id')
        .single();
      expect(error).toBeNull();
      expect((await db.from('item_logs').insert({ log_id: log!.id, position: 1, type: 'time', technique: 4, effort })).error).toBeNull();
    };
    await finish(neha.id, 1, india(-1), 9, '');
    await finish(neha.id, 2, india(), 10, 'Gassed by round 4.');

    await signInWithEmail(page, coach.email);
    await page.goto('/coach');
    await expect(page.getByRole('heading', { level: 1, name: 'Athletes' })).toBeVisible();

    const stats = page.locator('dl[aria-label="This week"]');
    await expect(stats).toContainText('Active athletes2');

    const board = page.getByRole('list', { name: 'Athletes this week' });
    await expect(board.getByRole('listitem')).toHaveCount(2);
    await expect(board).not.toContainText('Sana');
    const nehaRow = board.getByRole('listitem').filter({ hasText: 'Neha' });
    await expect(nehaRow).toContainText('Gassed by round 4.');
    await expect(nehaRow).toContainText('100%');

    const attention = page.getByRole('region', { name: 'Needs your attention' });
    await expect(attention.getByRole('listitem').filter({ hasText: 'Ravi' })).toContainText('3 sessions missed in a row. No log yet.');
    await expect(attention.getByRole('listitem').filter({ hasText: 'Neha' })).toContainText('Effort 9 or higher in the last two sessions.');
  });
});
