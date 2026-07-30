import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { PullRequestState } from '@goodboy/types';
import type { ActionBusy } from './PrActionBar';

type Params = {
  readonly canMerge?: boolean;
  readonly busy?: ActionBusy;
  readonly onMerge?: () => Promise<void>;
};

const PR = {
  number: 42,
  title: 'Consolidate pull request controls',
  url: 'https://github.com/goodboy/goodboy/pull/42',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/consolidate-pr-controls',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-07-30T10:00:00Z',
} satisfies PullRequestState;

import { PrActionBar } from './PrActionBar';

const renderActionBar = ({
  canMerge = true,
  busy = null,
  onMerge = vi.fn(async () => undefined),
}: Params = {}) =>
  render(
    <PrActionBar
      pr={PR}
      busy={busy}
      canMerge={canMerge}
      mergeReason={canMerge ? 'squash merge this PR' : 'PR has conflicts, resolve them first'}
      onMarkReady={vi.fn()}
      onConvertDraft={vi.fn()}
      onClose={vi.fn()}
      onReopen={vi.fn()}
      onCreateNew={vi.fn()}
      onMerge={onMerge}
    />,
  );

afterEach(cleanup);

describe('PrActionBar', () => {
  it('requires the shared danger confirmation before merging', async () => {
    const onMerge = vi.fn(async () => undefined);
    renderActionBar({ onMerge });

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    const confirmation = screen.getByRole('group', {
      name: 'Squash merge this pull request?',
    });
    expect(within(confirmation).getByText('This action cannot be undone.')).toBeDefined();
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Confirm merge' }));

    await waitFor(() => expect(onMerge).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Squash merge this pull request?' })).toBeNull(),
    );
  });

  it('keeps merge gating on the launch action', () => {
    renderActionBar({ canMerge: false });

    const merge = screen.getByRole('button', { name: 'Merge' });
    expect(merge.hasAttribute('disabled')).toBe(true);
    expect(merge.getAttribute('title')).toBe('PR has conflicts, resolve them first');
  });
});
