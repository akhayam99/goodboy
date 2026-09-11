import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId } from '@goodboy/types';
import type { PrWriteAnnouncement } from '../../../features/review/prWriteBus';

const hoisted = vi.hoisted(() => ({
  announcePrWrite: vi.fn<(announcement: unknown) => Promise<void>>(async () => undefined),
  currentWindowLabel: vi.fn(() => 'win-here'),
}));

vi.mock('../../../features/review/prWriteBus', () => ({
  announcePrWrite: hoisted.announcePrWrite,
}));
vi.mock('../../../features/workspace/window', () => ({
  currentWindowLabel: hoisted.currentWindowLabel,
}));

import { createPrWritesSlice } from './index';
import { PR_WRITE_CLAIM_TTL_MS, prWritesInitialState, type PrWritesState } from './state';
import { selectPrWrite } from './selectPrWrite';
import type { GetFn, SetFn } from './types';

const PROJECT_ID = 'project-1' as ProjectId;
const TARGET = { projectId: PROJECT_ID, prNumber: 248 };

const harness = () => {
  let state: Record<string, unknown> = { ...prWritesInitialState };
  const set = ((patch: unknown) => {
    const next =
      typeof patch === 'function'
        ? (patch as (s: Record<string, unknown>) => object)(state)
        : patch;
    state = { ...state, ...(next as object) };
  }) as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  const slice = createPrWritesSlice(set, get);
  state = { ...state, ...slice };
  return {
    slice,
    read: (): PrWritesState => state as unknown as PrWritesState,
  };
};

const announcementFrom = (call: number): PrWriteAnnouncement =>
  hoisted.announcePrWrite.mock.calls[call]?.[0] as PrWriteAnnouncement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-11T10:00:00.000Z'));
  hoisted.announcePrWrite.mockClear();
  hoisted.currentWindowLabel.mockReturnValue('win-here');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('pr writes slice', () => {
  it('grants a free pull request and tells the other windows', () => {
    const { slice, read } = harness();

    expect(slice.claimPrWrite({ ...TARGET, action: 'merge' }).ok).toBe(true);
    expect(read().prWriteClaims['project-1#248']?.action).toBe('merge');
    expect(announcementFrom(0).kind).toBe('claimed');
    expect(announcementFrom(0).key).toBe('project-1#248');
  });

  it('refuses a second write on the same pull request and names the one in flight', () => {
    const { slice } = harness();
    slice.claimPrWrite({ ...TARGET, action: 'merge' });

    const second = slice.claimPrWrite({ ...TARGET, action: 'close' });

    expect(second.ok).toBe(false);
    expect(second.ok === false && second.claim.action).toBe('merge');
  });

  it('leaves a different pull request of the same project alone', () => {
    const { slice } = harness();
    slice.claimPrWrite({ ...TARGET, action: 'merge' });

    expect(slice.claimPrWrite({ projectId: PROJECT_ID, prNumber: 249, action: 'merge' }).ok).toBe(
      true,
    );
  });

  it('frees the pull request on release and announces it', () => {
    const { slice, read } = harness();
    const claimed = slice.claimPrWrite({ ...TARGET, action: 'merge' });

    slice.releasePrWrite({ ...TARGET, token: claimed.ok ? claimed.token : '' });

    expect(read().prWriteClaims['project-1#248']).toBeUndefined();
    expect(announcementFrom(1).kind).toBe('released');
    expect(slice.claimPrWrite({ ...TARGET, action: 'close' }).ok).toBe(true);
  });

  it('never frees a claim the caller does not hold', () => {
    const { slice, read } = harness();
    slice.claimPrWrite({ ...TARGET, action: 'merge' });

    slice.releasePrWrite({ ...TARGET, token: 'win-here-0-0' });

    expect(read().prWriteClaims['project-1#248']?.action).toBe('merge');
  });

  it('never releases a claim another window holds', () => {
    const { slice, read } = harness();
    slice.notePrWrite({
      kind: 'claimed',
      key: 'project-1#248',
      token: 'win-other-1',
      windowLabel: 'win-other',
      action: 'merge',
      startedAt: Date.now(),
    });

    slice.releasePrWrite({ ...TARGET, token: 'win-here-1' });

    expect(read().prWriteClaims['project-1#248']?.windowLabel).toBe('win-other');
  });

  it('refuses a write another window announced', () => {
    const { slice } = harness();
    slice.notePrWrite({
      kind: 'claimed',
      key: 'project-1#248',
      token: 'win-other-1',
      windowLabel: 'win-other',
      action: 'close',
      startedAt: Date.now(),
    });

    expect(slice.claimPrWrite({ ...TARGET, action: 'merge' }).ok).toBe(false);
  });

  it('ignores a release announced against a claim that is no longer the one held', () => {
    const { slice, read } = harness();
    slice.claimPrWrite({ ...TARGET, action: 'merge' });

    slice.notePrWrite({
      kind: 'released',
      key: 'project-1#248',
      token: 'win-other-1',
      windowLabel: 'win-other',
      action: 'merge',
      startedAt: Date.now(),
    });

    expect(read().prWriteClaims['project-1#248']?.windowLabel).toBe('win-here');
  });

  it('lets a claim expire so a dead window cannot wedge the pull request', () => {
    const { slice, read } = harness();
    slice.claimPrWrite({ ...TARGET, action: 'merge' });

    vi.advanceTimersByTime(PR_WRITE_CLAIM_TTL_MS);
    const second = slice.claimPrWrite({ ...TARGET, action: 'close' });
    expect(second.ok).toBe(true);

    slice.releasePrWrite({ ...TARGET, token: second.ok ? second.token : '' });
    slice.notePrWrite({
      kind: 'claimed',
      key: 'project-1#249',
      token: 'win-other-1',
      windowLabel: 'win-other',
      action: 'merge',
      startedAt: Date.now(),
    });
    vi.advanceTimersByTime(PR_WRITE_CLAIM_TTL_MS);
    slice.sweepPrWriteClaims();

    expect(read().prWriteClaims).toEqual({});
  });

  it('reads back the claim a surface should show, and nothing without a target', () => {
    const { slice, read } = harness();
    slice.claimPrWrite({ ...TARGET, action: 'merge' });

    expect(selectPrWrite({ state: read(), target: TARGET })?.action).toBe('merge');
    expect(selectPrWrite({ state: read(), target: null })).toBeNull();
  });
});
