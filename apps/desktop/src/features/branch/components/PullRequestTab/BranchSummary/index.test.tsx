// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { BranchCommit, FileDiff } from '@goodboy/types';
import type { BranchTab } from '../../../../../store/slices/navigation/types';
import { BranchSummary } from '.';

const COMMITS: ReadonlyArray<BranchCommit> = [
  {
    sha: 'a1',
    shortSha: 'a1b2c3d',
    subject: 'Keep the event id on every credit row',
    author: 'Dana Reyes',
    timestamp: 1_700_000_000,
    pushed: false,
    parentSha: null,
  },
];

const FILES: ReadonlyArray<FileDiff> = [
  {
    path: 'src/ledger.ts',
    status: 'modified',
    additions: 4,
    deletions: 1,
    binary: false,
    hunks: [],
  },
];

type DrawParams = {
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly onRetry?: () => void;
  readonly onOpen?: (tab: BranchTab) => void;
  readonly onOpenFolder?: (folder: string) => void;
};

const draw = ({
  isLoading = false,
  error = null,
  onRetry = vi.fn(),
  onOpen = vi.fn(),
  onOpenFolder = vi.fn(),
}: DrawParams) =>
  render(
    <BranchSummary
      commits={COMMITS}
      files={FILES}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      onOpen={onOpen}
      onOpenFolder={onOpenFolder}
    />,
  );

afterEach(cleanup);

describe('BranchSummary', () => {
  it('opens Commits and Files from its cards', () => {
    const onOpen = vi.fn();
    draw({ onOpen });
    fireEvent.click(screen.getByRole('button', { name: 'Open Commits' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Changes' }));
    expect(onOpen.mock.calls).toEqual([['commits'], ['files']]);
    expect(screen.getByText('commit on this branch, 1 not pushed').textContent).toBe(
      'commit on this branch, 1 not pushed',
    );
  });

  it('opens one folder from the Changes card', () => {
    const onOpen = vi.fn();
    const onOpenFolder = vi.fn();
    draw({ onOpen, onOpenFolder });
    fireEvent.click(screen.getByRole('button', { name: 'Open src in Files' }));
    expect(onOpenFolder.mock.calls).toEqual([['src']]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('shows a skeleton per card while the diff loads and no number', () => {
    draw({ isLoading: true });
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.queryByText('+4')).toBeNull();
  });

  it("shows Couldn't read this with Retry on both cards when the read fails", () => {
    const onRetry = vi.fn();
    draw({ error: 'git failed', onRetry });
    expect(screen.getAllByText("Couldn't read this")).toHaveLength(2);
    const [retry] = screen.getAllByRole('button', { name: 'Retry' });
    if (retry === undefined) {
      throw new Error('no Retry button');
    }
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
