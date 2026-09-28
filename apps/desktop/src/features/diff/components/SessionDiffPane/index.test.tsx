// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { MountId, SessionId, WorktreeStatus } from '@goodboy/types';

const h = vi.hoisted(() => ({
  status: null as unknown,
  commits: [] as ReadonlyArray<unknown>,
  prediction: null as null | { conflictFiles: ReadonlyArray<string>; isClean: boolean },
  store: {} as Record<string, unknown>,
}));

const SESSION_ID = 'session-1' as SessionId;
const MOUNT = {
  mountId: 'mount-ledger' as MountId,
  projectId: 'project-ledger',
  mountName: 'ledger-core',
  branch: 'fix/ledger-reconcile-postings',
  worktreePath: '/w/ledger',
  repoRoot: '/repo/ledger',
  baseBranch: null,
};

const baseStore = () => ({
  settings: {},
  projects: [{ id: 'project-ledger', kind: 'repo', baseBranch: 'main', rootPath: '/repo/ledger' }],
  sessions: [],
  terminalTabs: {},
  sessionPhaseRuns: {},
  sessionResolveAttempts: {},
  sessionActiveMount: {},
  detectedEditors: [],
  mountGithub: {} as Record<string, unknown>,
  mountGitlabMr: {},
  mountBitbucketPr: {},
  sessionMounts: {
    [SESSION_ID]: [
      {
        id: MOUNT.mountId,
        sessionId: SESSION_ID,
        projectId: MOUNT.projectId,
        worktreePath: MOUNT.worktreePath,
        lastWorktreePath: MOUNT.worktreePath,
        branch: MOUNT.branch,
        baseBranch: null,
        parallelIndex: 0,
        mountName: MOUNT.mountName,
        repoSlug: null,
        repoRoot: MOUNT.repoRoot,
        isAttached: true,
        diskState: 'present',
        revision: 0,
      },
    ],
  },
  emitNotification: vi.fn(),
  rebaseBranch: vi.fn(async () => 'rebased'),
  openRewriteHistory: vi.fn(),
  openMountRequest: vi.fn(async () => ({ kind: 'opened' })),
  navigate: vi.fn(),
});

vi.mock('../../../../store', () => ({
  useAppStore: Object.assign(
    <T,>(selector: (state: Record<string, unknown>) => T) => selector(h.store),
    { getState: () => h.store, subscribe: () => () => undefined },
  ),
}));

vi.mock('../../../../store/slices/project-mounts/selectors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../store/slices/project-mounts/selectors')>()),
  selectMountForPath: () => MOUNT,
}));

vi.mock('../../hooks/useSessionDiff', () => ({
  useSessionDiff: () => ({
    files: [],
    patch: '',
    loading: false,
    error: null,
    view: { kind: 'branch' },
    setView: vi.fn(),
    commits: h.commits,
    status: h.status,
    metaError: null,
    refresh: vi.fn(),
    viewed: {},
    focusPath: null,
    clearFocus: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDiffNotes', () => ({
  useDiffNotes: () => ({ comments: [], openNotes: [] }),
}));

vi.mock('../../../session/hooks/useRebaseBranch', () => ({
  useRebaseBranch: () => ({ canRebase: true, isRunning: false, error: null, run: vi.fn() }),
}));

vi.mock('../../../history/useRebasePrediction', () => ({
  useRebasePrediction: () => h.prediction,
}));

vi.mock('../../../permissions/components/DiffViewSelector', () => ({
  DiffViewSelector: () => <button type="button">Branch vs main</button>,
}));

vi.mock('../../../worktree/useMountRemoteHostKind', () => ({
  useMountRemoteHostKind: () => 'github',
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../../session/hooks/useWorktreeStatuses/cache', () => ({
  ensure: vi.fn(async () => null),
  worktreeStatusKey: () => 'key',
}));

vi.mock('../../../worktree/BaseBranchSelect', () => ({
  BaseBranchSelect: () => <span data-testid="base-branch-select" />,
}));

import { SessionDiffPane } from './index';

const statusOf = ({
  upstream = 'origin/fix',
  ahead = 3,
  behind = 0,
  changed = 0,
  inProgress = null,
}: {
  readonly upstream?: string | null;
  readonly ahead?: number;
  readonly behind?: number;
  readonly changed?: number;
  readonly inProgress?: WorktreeStatus['inProgress'];
}): WorktreeStatus => ({
  branch: MOUNT.branch,
  head: null,
  headSubject: null,
  upstream,
  mainDistance: { kind: 'known', ahead, behind },
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: changed, untracked: 0, unmerged: 0, changed },
  inProgress,
});

const withPr = () => {
  h.store = {
    ...h.store,
    mountGithub: {
      [MOUNT.mountId]: {
        pr: {
          number: 318,
          title: 'Reconcile postings',
          url: 'https://github.com/acme/ledger-core/pull/318',
          state: 'open',
          isDraft: false,
          headSha: null,
        },
        repository: null,
        host: null,
        detail: null,
      },
    },
  };
};

const renderPane = () =>
  render(
    <SessionDiffPane
      sessionId={SESSION_ID}
      workingDir="/w/ledger"
      worktreePath={MOUNT.worktreePath}
      diffFocus={null}
      branchRevision={0}
    />,
  );

afterEach(() => {
  cleanup();
  h.status = null;
  h.commits = [];
  h.prediction = null;
  h.store = baseStore();
});

h.store = baseStore();

describe('SessionDiffPane header', () => {
  it('rebases on main as the one primary when the branch is behind', async () => {
    withPr();
    h.status = statusOf({ behind: 18 });
    renderPane();

    expect(screen.getByText('Behind main by 18')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Rebase on main' }));

    await waitFor(() =>
      expect(h.store['rebaseBranch']).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        mountId: MOUNT.mountId,
      }),
    );
  });

  it('names the predicted conflict on the rebase button before anything runs', () => {
    withPr();
    h.status = statusOf({ behind: 18 });
    h.prediction = { conflictFiles: ['src/ledger/postings.ts'], isClean: false };
    renderPane();

    expect(screen.getByRole('button', { name: 'Rebase on main · 1 conflict' })).toBeDefined();
  });

  it('keeps Rebase visible and disabled with its reason while changes are uncommitted', () => {
    withPr();
    h.status = statusOf({ behind: 4, changed: 2 });
    renderPane();

    const rebase = screen.getByRole('button', { name: 'Rebase on main' }) as HTMLButtonElement;
    expect(rebase.disabled).toBe(true);
    expect(screen.getAllByText('Commit or discard the 2 uncommitted changes first.')).toHaveLength(
      1,
    );
    expect(screen.getByText('Rebase on main, Rewrite history')).toBeDefined();
  });

  it('offers Create PR on a branch with commits and no pull request', async () => {
    h.status = statusOf({ upstream: null });
    renderPane();

    expect(screen.getByText('Local only')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Create PR' }));

    await waitFor(() =>
      expect(h.store['openMountRequest']).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        mountId: MOUNT.mountId,
        provider: 'github',
      }),
    );
  });

  it('links its pull request and keeps Rewrite history as a secondary', async () => {
    withPr();
    h.status = statusOf({});
    renderPane();

    expect(screen.queryByRole('button', { name: 'Rebase on main' })).toBeNull();
    const rewrite = screen.getByRole('button', { name: 'Rewrite history' }) as HTMLButtonElement;
    fireEvent.click(rewrite);
    expect(h.store['openRewriteHistory']).toHaveBeenCalledWith(SESSION_ID, MOUNT.worktreePath);
    await waitFor(() => expect(rewrite.disabled).toBe(false));

    fireEvent.click(screen.getByRole('button', { name: 'Open PR #318' }));
    await waitFor(() =>
      expect(h.store['openMountRequest']).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        mountId: MOUNT.mountId,
        provider: 'github',
        requestNumber: 318,
      }),
    );
  });

  it('offers the terminal and Abort rebase while a rebase is stopped, and confirms the abort inline', () => {
    withPr();
    h.status = statusOf({ changed: 3, inProgress: 'rebase' });
    renderPane();

    expect(screen.getByRole('button', { name: 'Open terminal' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Abort rebase' }));

    const confirm = screen.getByRole('group', { name: 'Abort the rebase?' });
    expect(within(confirm).getByRole('button', { name: 'Abort rebase' })).toBeDefined();
  });

  it('puts Change base branch and Restore a backup in the menu, and no Conversations in the header', () => {
    withPr();
    h.status = statusOf({});
    renderPane();

    expect(screen.queryByRole('button', { name: /Conversations/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Diff actions' }));
    const labels = screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
    expect(labels.some((label) => label.startsWith('Change base branch'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Restore a backup'))).toBe(true);
  });

  it('opens the base branch picker in place when the menu asks for it', async () => {
    withPr();
    h.status = statusOf({});
    renderPane();

    window.dispatchEvent(new CustomEvent(`goodboy:diff-change-base:${SESSION_ID}`));

    expect(await screen.findByTestId('base-branch-select')).toBeDefined();
    expect(screen.getByText('Compare with')).toBeDefined();
  });

  it('keeps the view selector in the file toolbar, under the title', () => {
    h.status = statusOf({});
    renderPane();

    const header = document.querySelector('[data-slot="pane-header"]') as HTMLElement;
    const title = within(header).getByRole('heading', { name: 'Diff' });
    const selector = within(header).getByRole('button', { name: 'Branch vs main' });
    expect(title.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title.closest('div')?.contains(selector)).toBe(false);
  });
});
