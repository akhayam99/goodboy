import { describe, expect, it } from 'vitest';
import { withProviderStrike } from './providerStrikes';

const NOW = Date.parse('2026-11-24T10:00:00.000Z');

describe('withProviderStrike', () => {
  it('keeps the latest rate limit per provider and leaves the others alone', () => {
    const first = withProviderStrike({
      strikes: { codex: NOW - 5 },
      provider: 'cursor',
      atMs: NOW,
    });
    const late = withProviderStrike({ strikes: first, provider: 'cursor', atMs: NOW - 1_000 });

    expect(late).toEqual({ codex: NOW - 5, cursor: NOW });
  });
});
