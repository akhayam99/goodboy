import { describe, expect, it } from 'vitest';
import { compareIsoDesc, instantOf } from './compareIsoDesc';

describe('instantOf', () => {
  it('reads a compact offset like the one Jira sends', () => {
    expect(instantOf({ iso: '2026-09-29T10:00:00.000+0200' })).toBe(Date.UTC(2026, 8, 29, 8));
    expect(instantOf({ iso: '2026-09-29T10:00:00.000-0530' })).toBe(Date.UTC(2026, 8, 29, 15, 30));
  });

  it('reads Z, colon offsets and bare dates', () => {
    expect(instantOf({ iso: '2026-09-29T08:00:00Z' })).toBe(Date.UTC(2026, 8, 29, 8));
    expect(instantOf({ iso: '2026-09-29T10:00:00+02:00' })).toBe(Date.UTC(2026, 8, 29, 8));
    expect(instantOf({ iso: '2026-09-29' })).toBe(Date.UTC(2026, 8, 29));
  });

  it('maps empty and unparsable values to zero', () => {
    expect(instantOf({ iso: '' })).toBe(0);
    expect(instantOf({ iso: 'not a date' })).toBe(0);
  });
});

describe('compareIsoDesc', () => {
  const jira = '2026-09-29T10:30:00.000+0200';
  const github = '2026-09-29T09:00:00Z';

  it('puts the later instant first even when the strings sort the other way', () => {
    expect(jira.localeCompare(github)).toBeGreaterThan(0);
    expect([jira, github].sort((left, right) => compareIsoDesc({ left, right }))).toEqual([
      github,
      jira,
    ]);
  });

  it('returns zero for the same instant written in two zones', () => {
    expect(
      compareIsoDesc({ left: '2026-09-29T10:00:00+0200', right: '2026-09-29T08:00:00Z' }),
    ).toBe(0);
  });

  it('sinks undated values below dated ones', () => {
    expect(compareIsoDesc({ left: '', right: github })).toBeGreaterThan(0);
  });
});
