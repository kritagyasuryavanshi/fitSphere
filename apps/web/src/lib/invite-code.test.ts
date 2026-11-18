import { describe, expect, it } from 'vitest';
import { INVITE_CODE, inviteCode } from './invite-code';

const code = '84f0f06c696d406e82f5ceb5dece8015';

describe('inviteCode', () => {
  it('reads the code from a full link, a path, or the code alone', () => {
    expect(inviteCode(`https://fitsphere.in/join/${code}`)).toBe(code);
    expect(inviteCode(`  http://localhost:3000/join/${code}?ref=wa  `)).toBe(code);
    expect(inviteCode(`/join/${code}`)).toBe(code);
    expect(inviteCode(code.toUpperCase())).toBe(code);
  });
  it('reads the forms people paste from a chat', () => {
    expect(inviteCode(`fitsphere.in/join/${code}`)).toBe(code);
    expect(inviteCode(`https://fitsphere.in/join/${code}/`)).toBe(code);
    expect(inviteCode(`Join my program Boxing Fundamentals on FitSphere: https://fitsphere.in/join/${code}`)).toBe(code);
  });
  it('refuses anything else', () => {
    expect(inviteCode('')).toBeNull();
    expect(inviteCode('https://fitsphere.in/join/123')).toBeNull();
    expect(inviteCode(`https://fitsphere.in/learn/${code}`)).toBeNull();
    expect(inviteCode(`${code}0`)).toBeNull();
    expect(inviteCode(`https://fitsphere.in/join/${code}0`)).toBeNull();
  });
  it('shares one pattern with the join page', () => {
    expect(INVITE_CODE.test(code)).toBe(true);
    expect(INVITE_CODE.test(code.toUpperCase())).toBe(false);
  });
});
