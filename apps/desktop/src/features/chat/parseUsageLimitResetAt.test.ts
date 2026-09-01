import { describe, expect, it } from 'vitest';
import { parseUsageLimitResetAt } from './parseUsageLimitResetAt';

const NOW = new Date(2026, 6, 30, 9, 0, 0).getTime();

describe('parseUsageLimitResetAt', () => {
  it('parses a 12 hour reset time later today', () => {
    expect(
      parseUsageLimitResetAt({
        message: "You've hit your usage limit. Upgrade to Pro or try again at 3:10 PM.",
        nowMs: NOW,
      }),
    ).toBe(new Date(2026, 6, 30, 15, 10, 0, 0).getTime());
  });

  it('parses a 24 hour reset time', () => {
    expect(
      parseUsageLimitResetAt({ message: 'usage limit reached, try again at 21:45', nowMs: NOW }),
    ).toBe(new Date(2026, 6, 30, 21, 45, 0, 0).getTime());
  });

  it('moves a reset time that already passed to tomorrow', () => {
    expect(parseUsageLimitResetAt({ message: 'try again at 8:30 AM', nowMs: NOW })).toBe(
      new Date(2026, 6, 31, 8, 30, 0, 0).getTime(),
    );
  });

  it('returns null when the message carries no reset time', () => {
    expect(parseUsageLimitResetAt({ message: 'usage limit reached', nowMs: NOW })).toBeNull();
  });

  it('returns null for an impossible clock reading', () => {
    expect(parseUsageLimitResetAt({ message: 'try again at 25:99', nowMs: NOW })).toBeNull();
    expect(parseUsageLimitResetAt({ message: 'try again at 15:10 PM', nowMs: NOW })).toBeNull();
  });
});
