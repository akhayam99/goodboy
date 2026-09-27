import { describe, expect, it } from 'vitest';
import type { IsoDateTime, MountId, PullRequestState } from '@goodboy/types';
import { toMountPullRequestLink } from './mountPrLink';

const mountId = 'mount-1' as MountId;
const observedAt = '2026-09-27T10:00:00.000Z' as IsoDateTime;

const pr = (patch: Partial<PullRequestState>): PullRequestState => ({
  number: 12,
  title: 'Close the ledger month',
  url: 'https://github.com/harborline/ledger-core/pull/12',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'goodboy/ledger-close',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-09-27T09:00:00.000Z',
  headSha: 'abc123',
  mergedAt: null,
  ...patch,
});

const link = (patch: Partial<PullRequestState>) =>
  toMountPullRequestLink({
    mountId,
    repository: 'harborline/ledger-core',
    pr: pr(patch),
    existing: null,
    observedAt,
  });

describe('toMountPullRequestLink', () => {
  it('records the head sha only once the pull request merged', () => {
    expect(link({}).mergedHeadSha).toBeNull();
    expect(link({ state: 'merged', mergedAt: '2026-09-27T09:30:00Z' })).toMatchObject({
      mergedHeadSha: 'abc123',
      mergedAt: '2026-09-27T09:30:00.000Z',
    });
  });

  it('keeps the recorded merged head when a later poll has none', () => {
    const first = link({ state: 'merged' });
    const next = toMountPullRequestLink({
      mountId,
      repository: 'harborline/ledger-core',
      pr: pr({ state: 'merged', headSha: null }),
      existing: first,
      observedAt,
    });

    expect(next.mergedHeadSha).toBe('abc123');
  });
});
