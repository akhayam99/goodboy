// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { chatRowTime } from './chatRowTime';

const NOW = new Date(2026, 8, 28, 15, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;

const at = (ms: number): IsoDateTime => new Date(ms).toISOString() as IsoDateTime;

describe('chatRowTime', () => {
  it('shows no age on a chat that went quiet, its Idle group already says it', () => {
    expect(
      chatRowTime({ chat: { lastActivityAt: at(NOW - 9 * DAY), pinnedAt: null }, now: NOW }),
    ).toBe('');
  });

  it('never calls a pinned chat idle', () => {
    const label = chatRowTime({
      chat: { lastActivityAt: at(NOW - 9 * DAY), pinnedAt: at(NOW - 10 * DAY) },
      now: NOW,
    });
    expect(label).toBe('9d ago');
  });

  it('reads a recent chat as an age', () => {
    expect(
      chatRowTime({ chat: { lastActivityAt: at(NOW - 4 * 60_000), pinnedAt: null }, now: NOW }),
    ).toBe('4m ago');
  });
});
