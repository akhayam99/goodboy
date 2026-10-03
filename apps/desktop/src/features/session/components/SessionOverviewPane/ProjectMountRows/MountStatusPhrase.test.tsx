// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { WorktreeStatus } from '@goodboy/types';
import { tooltipTextOf } from '../../../../../__tests__/helpers/tooltip';
import { MountStatusPhrase } from './MountStatusPhrase';

const statusOf = (overrides: Partial<WorktreeStatus> = {}): WorktreeStatus => ({
  branch: 'hl/fix-duplicate-credit',
  head: 'abc123',
  headSubject: 'base',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  mainDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/hl/fix-duplicate-credit',
  inProgress: null,
  ...overrides,
});

type PhraseParams = {
  readonly status?: WorktreeStatus | null;
  readonly isPending?: boolean;
  readonly isSkeleton?: boolean;
  readonly isMerged?: boolean;
  readonly commitsAfterMerge?: number | null;
  readonly isRepo?: boolean;
};

const renderPhrase = ({
  status = statusOf(),
  isPending = false,
  isSkeleton = false,
  isMerged = false,
  commitsAfterMerge = null,
  isRepo = true,
}: PhraseParams = {}) =>
  render(
    <MountStatusPhrase
      label="payments-api"
      status={status}
      series={{ seriesId: 's1', name: 'Retry rewrite', position: 2, plannedCount: 3, label: '2/3' }}
      isRepo={isRepo}
      isPending={isPending}
      isSkeleton={isSkeleton}
      isMerged={isMerged}
      isRebasing={false}
      commitsAfterMerge={commitsAfterMerge}
    />,
  );

afterEach(cleanup);

describe('MountStatusPhrase', () => {
  it('says a clean pushed branch is up to date', () => {
    renderPhrase();

    screen.getByText('Up to date');
  });

  it('names how many commits wait to be pushed', () => {
    renderPhrase({
      status: statusOf({ upstreamDistance: { kind: 'known', ahead: 2, behind: 0 } }),
    });

    screen.getByText('2 to push');
  });

  it('names a branch never pushed as local only', () => {
    renderPhrase({
      status: statusOf({
        upstream: null,
        upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
      }),
    });

    screen.getByText('Local only');
  });

  it('says merged, then the new commits, when the branch moved past its merge', () => {
    renderPhrase({ isMerged: true, commitsAfterMerge: 2 });

    screen.getByText('Merged, then 2 new commits');
  });

  it('keeps the distance from main and the part of a split one hover away', () => {
    renderPhrase({ status: statusOf({ mainDistance: { kind: 'known', ahead: 1, behind: 3 } }) });

    const phrase = screen.getByText('Up to date');
    expect(tooltipTextOf({ element: phrase })).toContain('Behind main by 3');
    expect(tooltipTextOf({ element: phrase })).toContain('Part 2/3 of Retry rewrite');
  });

  it('holds a placeholder while the status is read or the session refreshes', () => {
    renderPhrase({ status: null, isPending: true });
    screen.getByTestId('mount-status-skeleton');
    cleanup();

    renderPhrase({ isSkeleton: true });
    screen.getByTestId('mount-status-skeleton');
    expect(screen.queryByText('Up to date')).toBeNull();
  });

  it('says nothing for a folder project', () => {
    renderPhrase({ isRepo: false });

    expect(screen.queryByText('Up to date')).toBeNull();
  });
});
