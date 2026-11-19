import { describe, expect, it } from 'vitest';
import { coachFlags } from './coach-flags';

const today = '2026-11-19';
const none = { scheduled: [], finished: [], painDates: [], today };

describe('coachFlags', () => {
  it('flags three missed sessions in a row, counting the whole run', () => {
    const scheduled = [
      { date: '2026-11-12', done: true },
      { date: '2026-11-14', done: false },
      { date: '2026-11-16', done: false },
      { date: '2026-11-18', done: false },
    ];
    expect(coachFlags({ ...none, scheduled })).toEqual([{ type: 'missed', count: 3 }]);
  });

  it('does not flag two misses, or misses broken by a done session', () => {
    expect(coachFlags({ ...none, scheduled: [{ date: '2026-11-16', done: false }, { date: '2026-11-18', done: false }] })).toEqual([]);
    const broken = [
      { date: '2026-11-12', done: false },
      { date: '2026-11-14', done: false },
      { date: '2026-11-16', done: true },
      { date: '2026-11-18', done: false },
    ];
    expect(coachFlags({ ...none, scheduled: broken })).toEqual([]);
  });

  it('ignores sessions scheduled for today or later: the athlete can still do them', () => {
    const scheduled = [
      { date: '2026-11-17', done: false },
      { date: '2026-11-18', done: false },
      { date: '2026-11-19', done: false },
      { date: '2026-11-20', done: false },
    ];
    expect(coachFlags({ ...none, scheduled })).toEqual([]);
  });

  it('flags high effort when each of the last two finished sessions averages 9 or more', () => {
    const finished = [
      { date: '2026-11-10', efforts: [5, 6] },
      { date: '2026-11-15', efforts: [9, 10] },
      { date: '2026-11-18', efforts: [9, 9, 9] },
    ];
    expect(coachFlags({ ...none, finished })).toEqual([{ type: 'effort' }]);
  });

  it('does not flag one hard session, or a mean under 9', () => {
    expect(coachFlags({ ...none, finished: [{ date: '2026-11-18', efforts: [10] }] })).toEqual([]);
    expect(coachFlags({ ...none, finished: [{ date: '2026-11-15', efforts: [10] }, { date: '2026-11-18', efforts: [10, 7] }] })).toEqual([]);
  });

  it('skips sessions without any effort, so they neither count nor break the pair', () => {
    const finished = [
      { date: '2026-11-15', efforts: [9] },
      { date: '2026-11-17', efforts: [] },
      { date: '2026-11-18', efforts: [9] },
    ];
    expect(coachFlags({ ...none, finished })).toEqual([{ type: 'effort' }]);
  });

  it('flags pain reported in the last 7 days, today included', () => {
    expect(coachFlags({ ...none, painDates: ['2026-11-13'] })).toEqual([{ type: 'pain' }]);
    expect(coachFlags({ ...none, painDates: ['2026-11-12'] })).toEqual([]);
  });

  it('orders flags pain, missed, effort', () => {
    const flags = coachFlags({
      scheduled: [1, 2, 3].map((d) => ({ date: `2026-11-1${d}`, done: false })),
      finished: [{ date: '2026-11-08', efforts: [9] }, { date: '2026-11-09', efforts: [9] }],
      painDates: [today],
      today,
    });
    expect(flags.map((f) => f.type)).toEqual(['pain', 'missed', 'effort']);
  });
});
