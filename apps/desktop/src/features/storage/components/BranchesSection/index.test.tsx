// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const WORKSPACE = 'ws-harborline' as WorkspaceId;
const nowS = Math.floor(Date.now() / 1000);

const { state, autoDelete } = vi.hoisted(() => ({
  state: {
    projects: [] as ReadonlyArray<Record<string, unknown>>,
    branchScans: {} as Record<string, unknown>,
    loadProjectBranches: vi.fn(async () => undefined),
    deleteBranches: vi.fn(async () => ({ deleted: [] as ReadonlyArray<unknown>, kept: [] })),
    restoreDeletedBranches: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
  },
  autoDelete: vi.fn(async (): Promise<boolean | null> => false),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));
vi.mock('../../../../store/slices/branch-cleanup/repoDeletesMergedBranches', () => ({
  repoDeletesMergedBranches: autoDelete,
}));
vi.mock('../../../../shared/components/SessionChip', () => ({
  SessionChip: ({ sessionId }: { readonly sessionId: string }) => <span>session {sessionId}</span>,
}));

import { BranchesSection } from './index';

const ledger = {
  id: 'proj-ledger',
  workspaceId: WORKSPACE,
  name: 'ledger-core',
  kind: 'repo',
  rootPath: '/repos/ledger-core',
  baseBranch: null,
};

const branch = (patch: Record<string, unknown>) => ({
  name: 'goodboy/ledger-close',
  sha: 'sha-close',
  authorEmail: 'dev@harborline.test',
  lastCommitAt: nowS - 86_400,
  location: 'on-origin',
  mergeState: { kind: 'merged-via-pr' },
  behind: null,
  ...patch,
});

const ready = (branches: ReadonlyArray<Record<string, unknown>>) => ({
  [ledger.id]: {
    status: 'ready',
    scan: { userEmail: 'dev@harborline.test', branches },
    goodboy: [
      { projectId: ledger.id, branch: 'goodboy/ledger-close', sessionId: 'session-close' },
      { projectId: ledger.id, branch: 'goodboy/rates-cache', sessionId: null },
    ],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  state.projects = [ledger];
  autoDelete.mockResolvedValue(false);
});
afterEach(cleanup);

describe('BranchesSection', () => {
  it('scans the projects in scope and lists safe Goodboy branches with their session', async () => {
    state.branchScans = ready([
      branch({}),
      branch({ name: 'spike/ledger-v2', mergeState: { kind: 'not-merged', ahead: 3 } }),
      branch({ name: 'main', mergeState: { kind: 'protected' } }),
    ]);
    render(<BranchesSection scope={{ kind: 'workspace', id: WORKSPACE }} />);

    await waitFor(() =>
      expect(state.loadProjectBranches).toHaveBeenCalledWith({ projectIds: [ledger.id] }),
    );
    expect(screen.getByText('goodboy/ledger-close')).toBeDefined();
    expect(screen.getByText('session session-close')).toBeDefined();
    expect(screen.getByText('Safe to delete · merged')).toBeDefined();
    expect(screen.queryByText('spike/ledger-v2')).toBeNull();
    expect(screen.queryByText('main')).toBeNull();
  });

  it('shows your own unmerged branches under Yours and All', () => {
    state.branchScans = ready([
      branch({
        name: 'spike/ledger-v2',
        mergeState: { kind: 'not-merged', ahead: 3 },
        behind: 214,
      }),
    ]);
    render(<BranchesSection scope={{ kind: 'workspace', id: WORKSPACE }} />);

    fireEvent.click(screen.getByRole('tab', { name: /Yours/ }));
    const allTab = screen
      .getAllByRole('tab', { name: /^All/ })
      .find((candidate) => !(candidate.textContent ?? '').includes('local'));
    if (allTab === undefined) {
      throw new Error('no All tab');
    }
    fireEvent.click(allTab);

    expect(screen.getByText('spike/ledger-v2')).toBeDefined();
    expect(screen.getByText('By you')).toBeDefined();
    expect(screen.getByText('Behind main by 214')).toBeDefined();
  });

  it('counts the commits that go when an unmerged branch is in the selection', async () => {
    state.branchScans = ready([
      branch({
        name: 'goodboy/rates-cache',
        location: 'gone-on-origin',
        mergeState: { kind: 'not-merged', ahead: 2 },
      }),
    ]);
    render(<BranchesSection scope={{ kind: 'workspace', id: WORKSPACE }} />);

    fireEvent.click(screen.getByRole('tab', { name: /Needs a look/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete…' }));

    expect(
      screen.getByText("1 isn't merged: 2 commits exist only in these branches."),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1 branch and 2 commits' }));
    await waitFor(() =>
      expect(state.deleteBranches).toHaveBeenCalledWith({
        targets: [
          {
            projectId: ledger.id,
            branch: 'goodboy/rates-cache',
            sha: 'sha-close',
            sessionId: null,
            alsoOrigin: false,
          },
        ],
      }),
    );
  });

  it('offers origin only where GitHub does not already delete merged branches', async () => {
    state.branchScans = ready([branch({})]);
    render(<BranchesSection scope={{ kind: 'workspace', id: WORKSPACE }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select 1 safe to delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1 branch' }));
    expect(await screen.findByText('Also delete 1 on origin')).toBeDefined();

    cleanup();
    autoDelete.mockResolvedValue(true);
    render(<BranchesSection scope={{ kind: 'workspace', id: WORKSPACE }} />);
    await waitFor(() => expect(autoDelete).toHaveBeenCalled());
    await Promise.resolve();
    fireEvent.click(screen.getByRole('button', { name: 'Select 1 safe to delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1 branch' }));
    await waitFor(() => expect(screen.queryByText('Also delete 1 on origin')).toBeNull());
  });

  it('says what was deleted and undoes the whole batch', async () => {
    state.branchScans = ready([branch({})]);
    state.deleteBranches.mockResolvedValueOnce({ deleted: [{ id: 'deleted-1' }], kept: [] });
    render(<BranchesSection scope={{ kind: 'workspace', id: WORKSPACE }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1 branch' }));

    expect(
      await screen.findByText('Deleted 1 branch. Each one can be restored for 14 days.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(state.restoreDeletedBranches).toHaveBeenCalledWith({ ids: ['deleted-1'] }),
    );
  });
});
