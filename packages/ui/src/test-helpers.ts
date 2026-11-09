import axe from 'axe-core';
import { expect } from 'vitest';

/** Fails on any serious or critical axe issue. Colour contrast needs a real browser, so it runs on /styleguide. */
export async function expectNoSeriousAxeIssues(container: Element) {
  const { violations } = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}
