// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    settings: {} as Record<string, string>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    loadDiffComments: vi.fn(async () => undefined),
    addDiffComment: vi.fn(async () => undefined),
    resolveDiffComment: vi.fn(async () => undefined),
    consumeDiffComments: vi.fn(async () => undefined),
    reopenDiffComment: vi.fn(async () => undefined),
    deleteDiffComment: vi.fn(async () => undefined),
    selectAgent: vi.fn(async () => undefined),
    spawnAgent: vi.fn(async () => 'a1'),
    sendTurn: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useDiffComments: () => [],
  useSummarizerStatus: () => ({ status: 'idle' }),
}));

vi.mock('../../../../features/github/github', () => ({
  ghPrDiff: vi.fn(async () => ''),
}));

vi.mock('../../../../features/worktree/worktree', () => ({
  listBranchCommits: vi.fn(async () => []),
  worktreeDiff: vi.fn(async () => ''),
  worktreeDiffCommit: vi.fn(async () => ''),
  worktreeDiffWorking: vi.fn(async () => ''),
  worktreeStatus: vi.fn(async () => ({
    head: null,
    headSubject: null,
    unstaged: 0,
    staged: 0,
    untracked: 0,
    hasUpstream: false,
    branch: null,
    ahead: 0,
    behind: 0,
  })),
}));

vi.mock('../DiffViewSelector', () => ({
  DiffViewSelector: () => null,
}));

vi.mock('@goodboy/core', () => ({
  parseUnifiedDiff: () => [],
}));

beforeEach(() => {
  state.settings = {};
  state.sessionPhaseRuns = {};
  state.loadDiffComments = vi.fn(async () => undefined);
});
afterEach(cleanup);

import { DiffViewerDialog } from './index';

describe('DiffViewerDialog', () => {
  it('renders an empty-state with the no-source error when no loader is configured', async () => {
    render(<DiffViewerDialog open onClose={vi.fn()} />);
    expect(await screen.findByText(/no diff source configured/i)).toBeDefined();
  });

  it('renders close button when open', () => {
    render(<DiffViewerDialog open onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^close$/i })).toBeDefined();
  });
});
