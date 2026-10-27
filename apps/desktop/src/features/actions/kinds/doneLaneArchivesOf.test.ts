// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { doneLaneArchivesOf } from './doneLaneArchivesOf';

const NOW = Date.parse('2026-10-18T10:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const DONE_OLDER_THAN_DAYS = 7;

const sessionOf = (id: string) =>
  aSession({
    id: brandId<SessionId>({ value: id }),
    goal: `Session ${id}`,
    updatedAt: brandId<IsoDateTime>({ value: '2026-10-01T00:00:00.000Z' }),
  });

const FRESH = sessionOf('fresh');
const WEEK = sessionOf('week');
const OLD = sessionOf('old');
const UNKNOWN = sessionOf('unknown');

const AGES: Readonly<Record<string, number | null>> = {
  fresh: NOW - DAY_MS,
  week: NOW - DONE_OLDER_THAN_DAYS * DAY_MS,
  old: NOW - (DONE_OLDER_THAN_DAYS * DAY_MS + 1),
  unknown: null,
};

const lastActivityMsOf = ({ sessionId }: { readonly sessionId: SessionId }) =>
  AGES[sessionId] ?? null;

describe('doneLaneArchivesOf', () => {
  it('archives all of Done, or only what is older than seven days, strictly', () => {
    const [all, older] = doneLaneArchivesOf({
      sessions: [FRESH, WEEK, OLD, UNKNOWN],
      lastActivityMsOf,
      nowMs: NOW,
    });

    expect(all).toMatchObject({ id: 'all', label: 'Archive all in Done', blockedReason: null });
    expect(all?.sessions).toHaveLength(4);
    expect(older).toMatchObject({
      id: 'older',
      label: 'Archive done older than 7 days',
      blockedReason: null,
    });
    expect(older?.sessions).toEqual([OLD]);
  });

  it('says why an item has nothing to archive instead of hiding it', () => {
    const [all, older] = doneLaneArchivesOf({
      sessions: [FRESH],
      lastActivityMsOf,
      nowMs: NOW,
    });

    expect(all?.blockedReason).toBeNull();
    expect(older?.blockedReason).toBe('Nothing in Done is older than 7 days.');
    expect(
      doneLaneArchivesOf({ sessions: [], lastActivityMsOf, nowMs: NOW })[0]?.blockedReason,
    ).toBe('Nothing is in Done.');
  });
});
