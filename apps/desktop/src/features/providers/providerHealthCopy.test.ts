// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { INITIAL_EVIDENCE, INITIAL_HEALTH } from '../../store/slices/providers/providerHealth';
import { checkedLine } from './providerHealthCopy';

const NOW = Date.parse('2026-10-10T10:00:00Z');

const connected = (overrides: Partial<typeof INITIAL_EVIDENCE>) => ({
  ...INITIAL_HEALTH,
  standing: 'connected' as const,
  evidence: { ...INITIAL_EVIDENCE, ...overrides },
});

describe('checkedLine', () => {
  it('says when the server last confirmed the sign-in', () => {
    const health = connected({ serverAccepted: true, lastGoodAt: NOW - 3 * 60_000 });

    expect(checkedLine({ health, nowMs: NOW })).toBe('checked 3m ago');
  });

  it('says nothing when the server never confirmed it, the chip carries that', () => {
    const health = connected({ serverAccepted: false, lastGoodAt: NOW - 3 * 60_000 });

    expect(checkedLine({ health, nowMs: NOW })).toBeNull();
  });

  it('says nothing for a provider that is not connected', () => {
    expect(checkedLine({ health: INITIAL_HEALTH, nowMs: NOW })).toBeNull();
  });
});
