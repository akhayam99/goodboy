import { describe, expect, it } from 'vitest';
import { evaluateStorageNudge, type StorageNudgeInput } from './evaluateStorageNudge';

const GB = 1024 ** 3;
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-25T10:00:00.000Z');

const input = (overrides: Partial<StorageNudgeInput>): StorageNudgeInput => ({
  canGoBytes: 25 * GB,
  canGoCount: 11,
  unownedCount: 15,
  diskFreeBytes: 61 * GB,
  suggestAfterDays: 30,
  lastNudgeAt: null,
  lastNudgeBytes: null,
  now: NOW,
  ...overrides,
});

describe('evaluateStorageNudge', () => {
  it('speaks up once safe idle folders pass 10 GB', () => {
    expect(evaluateStorageNudge(input({}))).toEqual({
      kind: 'notify',
      severity: 'info',
      bytes: 25 * GB,
      title: 'Goodboy can free 25 GB',
      body: '15 worktree folders have no session. 11 are safe to remove and idle for over 30 days.',
    });
  });

  it('stays quiet under the threshold', () => {
    expect(evaluateStorageNudge(input({ canGoBytes: 9 * GB })).kind).toBe('none');
  });

  it('stays quiet for 14 days after a nudge', () => {
    expect(
      evaluateStorageNudge(input({ lastNudgeAt: NOW - 13 * DAY, lastNudgeBytes: 0 })).kind,
    ).toBe('none');
  });

  it('after 14 days speaks again only when the amount grew by another 10 GB', () => {
    const base = { lastNudgeAt: NOW - 15 * DAY, lastNudgeBytes: 20 * GB };

    expect(evaluateStorageNudge(input({ ...base, canGoBytes: 29 * GB })).kind).toBe('none');
    expect(evaluateStorageNudge(input({ ...base, canGoBytes: 30 * GB })).kind).toBe('notify');
  });

  it('warns when the disk is almost full and at least 1 GB can go', () => {
    const nudge = evaluateStorageNudge(input({ diskFreeBytes: 8 * GB, canGoBytes: 2 * GB }));

    expect(nudge).toMatchObject({
      kind: 'notify',
      severity: 'warning',
      title: '8 GB free on this disk',
      body: 'Goodboy can free 2 GB of worktree folders nobody uses.',
    });
    expect(evaluateStorageNudge(input({ diskFreeBytes: 8 * GB, canGoBytes: GB / 2 })).kind).toBe(
      'none',
    );
  });
});
