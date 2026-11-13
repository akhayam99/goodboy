// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { INITIAL_EVIDENCE, INITIAL_HEALTH } from '../../store/slices/providers/providerHealth';
import { formatAge } from '../../shared/utils/time/formatAge';
import { cannotCheckBody, checkedLine } from './providerHealthCopy';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const AGES = [
  5_000,
  3 * MINUTE,
  59 * MINUTE,
  2 * HOUR,
  23 * HOUR,
  25 * HOUR,
  3 * DAY,
  40 * DAY,
] as const;

const NOWS = [
  Date.parse('2026-10-10T10:00:00Z'),
  Date.parse('2026-10-10T00:10:00Z'),
  Date.parse('2026-10-10T23:50:00Z'),
  Date.parse('2026-12-31T23:59:00Z'),
] as const;

const health = ({ lastGoodAt }: { readonly lastGoodAt: number }) => ({
  ...INITIAL_HEALTH,
  standing: 'connected' as const,
  evidence: { ...INITIAL_EVIDENCE, serverAccepted: true, lastGoodAt },
});

describe('provider health copy ages', () => {
  const cases = NOWS.flatMap((now) => AGES.map((age) => ({ now, age })));

  it.each(cases)('checkedLine equals formatAge at $age before $now', ({ now, age }) => {
    const expected = formatAge({ from: now - age, now });
    expect(checkedLine({ health: health({ lastGoodAt: now - age }), nowMs: now })).toBe(
      `checked ${expected}`,
    );
  });

  it.each(cases)('cannotCheckBody equals formatAge at $age before $now', ({ now, age }) => {
    const expected = formatAge({ from: now - age, now });
    expect(cannotCheckBody({ health: health({ lastGoodAt: now - age }), nowMs: now })).toBe(
      `Showing what we last knew, from ${expected}.`,
    );
  });
});
