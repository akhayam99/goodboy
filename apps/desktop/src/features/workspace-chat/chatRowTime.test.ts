import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { chatRowTime } from './chatRowTime';

const NOW = new Date(2026, 8, 28, 15, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;

const at = (ms: number): IsoDateTime => new Date(ms).toISOString() as IsoDateTime;

describe('chatRowTime', () => {
  it('counts idle days once a chat has gone quiet for a week', () => {
    expect(
      chatRowTime({ chat: { lastActivityAt: at(NOW - 9 * DAY), pinnedAt: null }, now: NOW }),
    ).toBe('idle 9d');
  });

  it('never calls a pinned chat idle', () => {
    const label = chatRowTime({
      chat: { lastActivityAt: at(NOW - 9 * DAY), pinnedAt: at(NOW - 10 * DAY) },
      now: NOW,
    });
    expect(label.startsWith('idle')).toBe(false);
  });

  it('shows the clock for a chat active today', () => {
    expect(
      chatRowTime({ chat: { lastActivityAt: at(NOW - 60_000), pinnedAt: null }, now: NOW }),
    ).toMatch(/\d{2}.\d{2}/);
  });
});
