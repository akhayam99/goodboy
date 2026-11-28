// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { LONG_RUNNING_MS, longRunningOf } from './longRunningOf';

const NOW = 1_800_000_000_000;
const HOUR_MS = 60 * 60 * 1000;

describe('longRunningOf', () => {
  it('keeps the running sessions that passed 24 hours, longest first', () => {
    const quick = aSession({ id: brandId<SessionId>({ value: 'session-quick' }) });
    const day = aSession({ id: brandId<SessionId>({ value: 'session-day' }) });
    const longest = aSession({ id: brandId<SessionId>({ value: 'session-longest' }) });

    const rows = longRunningOf({
      running: [quick, day, longest],
      sinceBySession: new Map([
        [quick.id, NOW - 2 * HOUR_MS],
        [day.id, NOW - LONG_RUNNING_MS],
        [longest.id, NOW - 49 * HOUR_MS],
      ]),
      nowMs: NOW,
    });

    expect(rows.map((row) => [row.session.id, row.activeMs / HOUR_MS])).toEqual([
      ['session-longest', 49],
      ['session-day', 24],
    ]);
  });

  it('leaves out a session with no known start', () => {
    const session = aSession({ id: brandId<SessionId>({ value: 'session-unknown' }) });

    expect(longRunningOf({ running: [session], sinceBySession: new Map(), nowMs: NOW })).toEqual(
      [],
    );
  });
});
