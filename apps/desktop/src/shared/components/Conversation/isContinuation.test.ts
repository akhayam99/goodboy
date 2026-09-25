import { describe, expect, it } from 'vitest';
import { fixtureMessage } from './conversationFixtures';
import { isContinuation } from './isContinuation';

const at = (createdAt: string, name = 'Jun Ota') =>
  fixtureMessage({ id: createdAt, name, body: 'x', createdAt });

describe('isContinuation', () => {
  it('joins a message from the same author within five minutes', () => {
    expect(
      isContinuation({ previous: at('2026-09-20T10:00:00Z'), message: at('2026-09-20T10:04:00Z') }),
    ).toBe(true);
  });

  it('keeps the header after five minutes or for another author', () => {
    expect(
      isContinuation({ previous: at('2026-09-20T10:00:00Z'), message: at('2026-09-20T10:06:00Z') }),
    ).toBe(false);
    expect(
      isContinuation({
        previous: at('2026-09-20T10:00:00Z'),
        message: at('2026-09-20T10:01:00Z', 'Sam Kerr'),
      }),
    ).toBe(false);
  });

  it('keeps the header on a message still sending', () => {
    const sending = { ...at('2026-09-20T10:01:00Z'), status: 'sending' as const };

    expect(isContinuation({ previous: at('2026-09-20T10:00:00Z'), message: sending })).toBe(false);
  });
});
