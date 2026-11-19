import { describe, expect, it } from 'vitest';
import { minutesBetween, summarise, type SummaryItem } from './session-summary';

const drills: SummaryItem[] = [
  { position: 1, title: 'Shadow boxing', type: 'rounds', plannedRounds: 2, log: { roundsDone: 2, technique: 4, effort: 5, sets: [] } },
  { position: 2, title: 'Step and jab', type: 'rounds', plannedRounds: 3, log: { roundsDone: 2, technique: 3, effort: 7, sets: [] } },
  { position: 3, title: 'Heavy bag', type: 'rounds', plannedRounds: 4, log: null },
  { position: 4, title: 'Skipping', type: 'time', plannedRounds: null, log: { roundsDone: null, technique: 5, effort: 3, sets: [] } },
];

describe('summarise', () => {
  it('counts drills, rounds of logged drills against all planned, and the mean technique, exactly', () => {
    expect(summarise(drills)).toEqual({
      itemsLogged: 3,
      items: 4,
      roundsDone: 4,
      roundsPlanned: 9,
      technique: 4,
      sets: 0,
      reps: 0,
      volumeKg: 0,
    });
  });

  it('rounds technique to one decimal', () => {
    const two = drills.slice(0, 2).map((d, i) => ({ ...d, log: { ...d.log!, technique: [4, 3][i]! } }));
    const three = [...two, { ...drills[3]!, log: { ...drills[3]!.log!, technique: 4 } }];
    expect(summarise(three).technique).toBe(3.7);
    expect(summarise([drills[2]!]).technique).toBeNull();
  });

  it('totals sets, reps and kilograms lifted to the cent, with bodyweight sets adding reps but no load', () => {
    const lifts: SummaryItem[] = [
      {
        position: 1,
        title: 'Bench',
        type: 'sets',
        plannedRounds: null,
        log: {
          roundsDone: null,
          technique: null,
          effort: null,
          sets: [
            { reps: 8, loadKg: 52.5 },
            { reps: 8, loadKg: 52.5 },
            { reps: 7, loadKg: 52.5 },
          ],
        },
      },
      { position: 2, title: 'Push-up', type: 'sets', plannedRounds: null, log: { roundsDone: null, technique: null, effort: null, sets: [{ reps: 10, loadKg: null }] } },
      { position: 3, title: 'Curl', type: 'sets', plannedRounds: null, log: { roundsDone: null, technique: null, effort: null, sets: [{ reps: 3, loadKg: 0.1 }, { reps: 3, loadKg: 0.2 }] } },
      { position: 4, title: 'Row', type: 'sets', plannedRounds: null, log: null },
    ];
    expect(summarise(lifts)).toMatchObject({ itemsLogged: 3, items: 4, sets: 6, reps: 39, volumeKg: 1208.4 });
  });
});

describe('minutesBetween', () => {
  it('rounds to whole minutes and is null without both times', () => {
    expect(minutesBetween('2026-11-19T10:00:00Z', '2026-11-19T10:36:20Z')).toBe(36);
    expect(minutesBetween('2026-11-19T10:00:00Z', '2026-11-19T10:36:40Z')).toBe(37);
    expect(minutesBetween('2026-11-19T10:00:00Z', null)).toBeNull();
  });
});
