// @vitest-environment happy-dom

import type { MountActionTarget } from '../../../../actions/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { IsoDateTime, MountId, ProjectId, SessionId, WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';

type RemoveWorktreeProps = {
  readonly label: string;
};

const { store, remoteKind } = vi.hoisted(() => ({
  remoteKind: { current: 'github' as string | null },
  store: {
    setSessionActiveMount: vi.fn(async () => undefined),
    setScriptsLensScope: vi.fn(),
    openMountDiff: vi.fn(async () => undefined),
    openMountTerminal: vi.fn(),
    openMountRequest: vi.fn(async () => ({ kind: 'opened' as const })),
    attachMount: vi.fn(async () => undefined),
    rebaseBranch: vi.fn(async () => 'rebased' as const),
    pushSessionBranch: vi.fn(async () => ({ ok: true as const })),
    unmountMount: vi.fn(async () => ({ kept: false })),
    openRewriteHistory: vi.fn(),
    openReviewTarget: vi.fn(async () => ({ kind: 'opened' as const })),
    mountGithub: {} as Record<string, unknown>,
    mountGitlabMr: {} as Record<string, unknown>,
    mountBitbucketPr: {} as Record<string, unknown>,
    projects: [] as ReadonlyArray<{ id: string; kind?: string; baseBranch?: string | null }>,
    emitNotification: vi.fn(),
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    detectedEditors: [] as ReadonlyArray<{ binary: string; label: string }>,
    settings: {} as Record<string, string>,
    reportError: vi.fn(),
    loadDetectedEditors: vi.fn(async () => undefined),
    terminalTabs: {} as Record<
      string,
      ReadonlyArray<{ id: string; projectId?: string; status: string }>
    >,
    scriptRuns: {} as Record<string, Record<string, { status: string }>>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<{ name: string; status: string }>>,
    projectScripts: {} as Record<string, ReadonlyArray<{ id: string; projectId: string }>>,
    sessions: [] as ReadonlyArray<Record<string, unknown>>,
    sessionActiveMount: {} as Record<string, string | null>,
    sessionActiveProject: {} as Record<string, string>,
    sessionMounts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionProjectMounts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    sessionOpenQuestions: {} as Record<string, ReadonlyArray<{ createdByAgentId?: string }>>,
    agentTurnState: {} as Record<string, { kind: string }>,
    agentTurnDestination: {} as Record<string, { kind: string; mountId?: string }>,
    navigate: vi.fn(),
    loadAgentTranscript: vi.fn(async () => undefined),
    sessionGithub: {} as Record<string, unknown>,
    sessionResolveThreads: {} as Record<string, ReadonlyArray<unknown>>,
    sessionExternalTasks: {} as Record<string, ReadonlyArray<unknown>>,
    openExternalTaskLens: vi.fn(),
  },
}));

vi.mock('../../../../../store', async () => ({
  ...(await import('../../../../../store/slices/navigation/place')),
  useAppStore: Object.assign(<T,>(selector: (state: typeof store) => T) => selector(store), {
    getState: () => store,
    subscribe: () => () => undefined,
  }),
}));
vi.mock('./ProjectBranchChip', () => ({
  ProjectBranchChip: () => <span data-testid="branch-chip" />,
}));
vi.mock('./RemoveWorktreeAction', () => ({
  RemoveWorktreeAction: ({ label }: RemoveWorktreeProps) => (
    <button type="button" aria-label={`Close branch for ${label}`}>
      Close branch
    </button>
  ),
}));
vi.mock('./MountBranchDecision', () => ({
  MountBranchDecision: () => <div data-testid="branch-decision" />,
}));
vi.mock('../../../../worktree/useMountRemoteHostKind', () => ({
  useMountRemoteHostKind: () => remoteKind.current,
}));
vi.mock('../../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('../../../../../shared/lib/editor', () => ({
  openInEditor: vi.fn(async () => undefined),
}));
vi.mock('../../../../../store/slices/worktreeStatuses/cache', () => ({
  ensure: vi.fn(async () => null),
  worktreeStatusKey: () => 'key',
}));
import { tooltipTextOf } from '../../../../../__tests__/helpers/tooltip';
import { openInEditor } from '../../../../../shared/lib/editor';
import { ProjectMountRow } from './ProjectMountRow';

const sessionId = 'session-1' as SessionId;

const baseRow: MountRowView = {
  mountId: 'mount-1' as MountId,
  projectId: 'api' as ProjectId,
  projectName: 'API',
  projectKind: 'repo',
  mountName: 'API',
  branch: 'feat/api',
  baseBranch: 'main',
  worktreePath: '/api',
  lastWorktreePath: '/api',
  repoRoot: '/repo/api',
  isAttached: true,
  isMainCheckout: false,
  isOnDisk: true,
  revision: 0,
  parallelIndex: 0,
  request: null,
  series: null,
  observation: null,
  observedBranchHolder: null,
  isCompleted: false,
};

const viewOf = ({ row }: { readonly row: MountRowView }) => ({
  id: row.mountId,
  sessionId,
  projectId: row.projectId,
  worktreePath: row.worktreePath,
  lastWorktreePath: row.lastWorktreePath,
  branch: row.branch,
  baseBranch: row.baseBranch,
  parallelIndex: 0,
  mountName: row.mountName,
  repoSlug: null,
  repoRoot: row.repoRoot,
  isAttached: row.isAttached,
  diskState: row.isOnDisk ? 'present' : 'removed',
  revision: 0,
});

const seedRequest = ({ row }: { readonly row: MountRowView }) => {
  if (row.request === null || store.mountGithub[row.mountId] !== undefined) {
    return;
  }
  store.mountGithub = {
    [row.mountId]: {
      pr: {
        number: row.request.number,
        title: row.request.title,
        url: row.request.url,
        state: row.request.state,
        isDraft: row.request.isDraft,
        headSha: null,
      },
      repository: null,
      host: null,
      detail: null,
    },
  };
};

const statusWith = (patch: Partial<WorktreeStatus>): WorktreeStatus => ({
  branch: 'feat/api',
  head: null,
  headSubject: null,
  mainDistance: { kind: 'known', ahead: 2, behind: 0 },
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/feat/api',
  inProgress: null,
  ...patch,
});

const renderRow = ({
  diffStat = null,
  worktreeStatus = null,
  isStatusPending = false,
  row = baseRow,
  label = 'API',
}: {
  readonly diffStat?: { additions: number; deletions: number } | null;
  readonly worktreeStatus?: WorktreeStatus | null;
  readonly isStatusPending?: boolean;
  readonly row?: MountRowView;
  readonly label?: string;
}) => {
  if (store.sessionMounts[sessionId] === undefined) {
    store.sessionMounts = { [sessionId]: [viewOf({ row })] };
  }
  seedRequest({ row });
  return render(
    <ul>
      <ProjectMountRow
        sessionId={sessionId}
        row={row}
        label={label}
        diffStat={diffStat}
        worktreeStatus={worktreeStatus}
        isStatusPending={isStatusPending}
      />
    </ul>,
  );
};

const openMenu = ({ label = 'API' }: { readonly label?: string } = {}) =>
  fireEvent.click(screen.getByRole('button', { name: `${label} actions` }));

beforeEach(() => {
  vi.clearAllMocks();
  remoteKind.current = 'github';
  store.terminalTabs = {};
  store.scriptRuns = {};
  store.projectScripts = {
    'ws-1': [
      { id: 'script-api', projectId: 'api' },
      { id: 'script-web', projectId: 'web' },
    ],
  };
  store.sessionWorktrees = { [sessionId]: ['/session-root'] };
  store.sessionPhaseRuns = {};
  store.detectedEditors = [{ binary: 'code', label: 'VS Code' }];
  store.sessions = [];
  store.sessionActiveMount = {};
  store.sessionActiveProject = {};
  store.sessionMounts = {};
  store.sessionProjectMounts = {};
  store.mountGithub = {};
  store.projects = [{ id: 'api', kind: 'repo', baseBranch: 'main' }];
  store.sessionOpenQuestions = {};
  store.agentTurnState = {};
  store.agentTurnDestination = {};
  store.mountGithub = {};
  store.sessionGithub = {};
  store.sessionResolveThreads = {};
  store.sessionExternalTasks = {};
});

afterEach(cleanup);

const openRequest: NonNullable<MountRowView['request']> = {
  provider: 'github',
  identity: null,
  number: 12,
  state: 'open',
  isDraft: false,
  checks: null,
  reviewDecision: null,
  url: 'https://github.com/acme/api/pull/12',
  title: 'Split one',
  label: 'PR #12',
};

const REQUEST_ROW: MountRowView = {
  ...baseRow,
  request: {
    provider: 'github',
    number: 318,
    label: 'PR #318',
    state: 'open',
    isDraft: false,
  } as unknown as MountRowView['request'],
};

const reviewComment = (threadId: string) => ({
  id: `c-${threadId}`,
  source: 'review',
  threadId,
  resolved: false,
  inReplyToId: null,
  author: 'kenji-w',
  body: 'Cap the retries.',
  createdAt: '2026-09-27T10:00:00.000Z',
  path: 'src/webhooks.ts',
  line: 12,
});

describe('ProjectMountRow layer links', () => {
  it('names the pull request with its number and state, and opens its page', async () => {
    renderRow({ row: REQUEST_ROW });

    const link = screen.getByRole('button', { name: 'Open PR #318 of API' });
    expect(link.textContent).toContain('PR #318');
    fireEvent.click(link);

    await waitFor(() =>
      expect(store.openMountRequest).toHaveBeenCalledWith({
        sessionId,
        mountId: 'mount-1',
        provider: 'github',
        requestNumber: 318,
      }),
    );
  });

  it('counts the comments to resolve on this pull request and opens Review on them', async () => {
    store.mountGithub = {
      'mount-1': {
        pr: { number: 318 },
        detail: { comments: [reviewComment('PRRT_1'), reviewComment('PRRT_2')] },
      },
    };
    renderRow({ row: REQUEST_ROW });

    const link = screen.getByRole('button', { name: 'Open Comments for API, 2 to resolve' });
    expect(link.textContent).toBe('2 to resolve');
    fireEvent.click(link);

    await waitFor(() =>
      expect(store.openReviewTarget).toHaveBeenCalledWith({
        sessionId,
        destination: { kind: 'comments', mountId: 'mount-1', prNumber: 318 },
      }),
    );
  });

  it('shows no resolve link when nothing waits', () => {
    store.mountGithub = { 'mount-1': { pr: { number: 318 }, detail: { comments: [] } } };
    renderRow({ row: REQUEST_ROW });

    expect(screen.queryByRole('button', { name: /to resolve/ })).toBeNull();
  });
});

describe('ProjectMountRow request action', () => {
  it('creates the pull request of this mount, without touching the window bus', async () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-github-session', listener);
    renderRow({ worktreeStatus: statusWith({}) });

    fireEvent.click(screen.getByRole('button', { name: 'Create PR for API' }));

    await waitFor(() =>
      expect(store.openMountRequest).toHaveBeenCalledWith({
        sessionId,
        mountId: 'mount-1',
        provider: 'github',
      }),
    );
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('goodboy:open-github-session', listener);
  });

  it('holds create pr with its reason while an agent is opening one', () => {
    store.sessionPhaseRuns = {
      [sessionId]: [{ name: 'open pull request', status: 'running' }],
    };
    renderRow({ worktreeStatus: statusWith({}) });

    const action = screen.getByRole('button', { name: 'Create PR for API' });
    expect(action.hasAttribute('disabled')).toBe(true);
    expect(tooltipTextOf({ element: action })).toBe('An agent is already opening a pull request.');
  });

  it('hides create pr while the branch has no commit of its own', () => {
    renderRow({
      worktreeStatus: statusWith({ mainDistance: { kind: 'known', ahead: 0, behind: 0 } }),
    });
    expect(screen.queryByRole('button', { name: 'Create PR for API' })).toBeNull();
  });

  it('shows the request of this mount instead of the create action', async () => {
    renderRow({ worktreeStatus: statusWith({}), row: { ...baseRow, request: openRequest } });

    expect(screen.queryByRole('button', { name: 'Create PR for API' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open PR #12 of API' }));

    await waitFor(() =>
      expect(store.openMountRequest).toHaveBeenCalledWith({
        sessionId,
        mountId: 'mount-1',
        provider: 'github',
        requestNumber: 12,
      }),
    );
  });

  it('offers create mr on a gitlab remote', () => {
    remoteKind.current = 'gitlab';
    renderRow({ worktreeStatus: statusWith({}) });
    expect(screen.getByRole('button', { name: 'Create MR for API' }).textContent).toBe('Create MR');
  });

  it('hides the action when the remote kind is unknown', () => {
    remoteKind.current = null;
    renderRow({ worktreeStatus: statusWith({}) });
    expect(screen.queryByRole('button', { name: 'Create PR for API' })).toBeNull();
  });
});

describe('ProjectMountRow one action by state', () => {
  it('offers Rebase on main when main moved, and runs it on this mount', async () => {
    renderRow({
      worktreeStatus: statusWith({ mainDistance: { kind: 'known', ahead: 2, behind: 4 } }),
      row: { ...baseRow, request: openRequest },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Rebase on main for API' }));

    await waitFor(() =>
      expect(store.rebaseBranch).toHaveBeenCalledWith({ sessionId, mountId: 'mount-1' }),
    );
  });

  it('keeps Rebase visible and disabled with its reason while changes are uncommitted', () => {
    renderRow({
      worktreeStatus: statusWith({
        mainDistance: { kind: 'known', ahead: 2, behind: 4 },
        workingTree: {
          kind: 'known',
          staged: 0,
          unstaged: 2,
          untracked: 0,
          unmerged: 0,
          changed: 2,
        },
      }),
      row: { ...baseRow, request: openRequest },
    });

    const rebase = screen.getByRole('button', { name: 'Rebase on main for API' });
    expect(rebase.hasAttribute('disabled')).toBe(true);
    expect(tooltipTextOf({ element: rebase })).toBe(
      'Commit or discard the 2 uncommitted changes first.',
    );
  });

  it('offers Push once commits wait on a branch with a pull request', async () => {
    renderRow({
      worktreeStatus: statusWith({ upstreamDistance: { kind: 'known', ahead: 2, behind: 0 } }),
      row: { ...baseRow, request: openRequest },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Push 2 commits for API' }));

    await waitFor(() =>
      expect(store.pushSessionBranch).toHaveBeenCalledWith({ sessionId, mountId: 'mount-1' }),
    );
  });

  it('raises a notice row under a failed push and runs it again on Retry', async () => {
    store.pushSessionBranch.mockResolvedValueOnce({
      ok: false,
      error: 'rejected by origin',
    } as never);
    renderRow({
      worktreeStatus: statusWith({ upstreamDistance: { kind: 'known', ahead: 2, behind: 0 } }),
      row: { ...baseRow, request: openRequest },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Push 2 commits for API' }));

    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain("Couldn't push API");
    expect(notice.textContent).toContain('Nothing was pushed.');
    fireEvent.click(within(notice).getByRole('button', { name: 'Details' }));
    expect(within(notice).getByText('rejected by origin')).toBeDefined();

    fireEvent.click(within(notice).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(store.pushSessionBranch).toHaveBeenCalledTimes(2));
  });
});

describe('ProjectMountRow availability', () => {
  const detached: MountRowView = {
    ...baseRow,
    isAttached: false,
    worktreePath: null,
    isOnDisk: true,
  };

  it('offers Reopen on a closed row and states the kept files in the state slot', async () => {
    renderRow({ row: detached });

    expect(screen.getByText('Files kept')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen for API' }));

    await waitFor(() =>
      expect(store.attachMount).toHaveBeenCalledWith({ sessionId, mountId: 'mount-1' }),
    );
  });

  it('puts a failed Reopen in a notice row and leaves the cells of the row alone', async () => {
    store.attachMount.mockRejectedValueOnce(new Error('worktree path is already in use'));
    renderRow({ row: detached });
    const cells = screen.getByTestId('project-mount-cells');
    const before = cells.innerHTML;

    fireEvent.click(screen.getByRole('button', { name: 'Reopen for API' }));

    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain("Couldn't reopen API");
    expect(cells.innerHTML).toBe(before);
    expect(cells.nextElementSibling?.contains(notice)).toBe(true);
    expect(within(cells).queryByRole('alert')).toBeNull();
    expect(cells.getAttribute('data-row-height')).toBe('36');

    fireEvent.click(within(notice).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(store.attachMount).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('keeps the worktree tools out of the menu of a closed row', () => {
    renderRow({ row: detached });
    openMenu();

    expect(screen.queryByRole('menuitem', { name: /Open terminal/ })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Remove from session/ })).toBeDefined();
  });

  it('shows a branch task only on the project it was linked in, not on a namesake branch', () => {
    const shared = 'feat/shared';
    store.projects = [
      { id: 'api', kind: 'repo', baseBranch: 'main' },
      { id: 'web', kind: 'repo', baseBranch: 'main' },
    ];
    store.sessionExternalTasks = {
      [sessionId]: [
        {
          sessionId,
          projectId: 'api',
          branch: shared,
          scope: 'branch',
          provider: 'linear',
          externalId: 'ext-41',
          identifier: 'NW-41',
          url: 'https://linear.example/NW-41',
          title: 'Ledger export',
          createdAt: '2026-09-27T10:00:00.000Z',
        },
      ],
    };
    const apiRow: MountRowView = { ...baseRow, branch: shared };
    const webRow: MountRowView = {
      ...baseRow,
      mountId: 'mount-2' as MountId,
      projectId: 'web' as ProjectId,
      projectName: 'Web',
      mountName: 'Web',
      branch: shared,
      worktreePath: '/web',
      lastWorktreePath: '/web',
      repoRoot: '/repo/web',
    };
    store.sessionMounts = { [sessionId]: [viewOf({ row: apiRow }), viewOf({ row: webRow })] };

    renderRow({ row: apiRow, label: 'API' });
    renderRow({ row: webRow, label: 'Web' });

    const apiItem = screen.getByRole('listitem', { name: 'API' });
    const webItem = screen.getByRole('listitem', { name: 'Web' });
    expect(within(apiItem).getByRole('button', { name: `Open NW-41 on ${shared}` })).toBeDefined();
    expect(within(webItem).queryByRole('button', { name: `Open NW-41 on ${shared}` })).toBeNull();
  });

  it('keeps the tasks of a branch on one line: the first chip and a +N popover for the rest', () => {
    const taskOf = ({ externalId, identifier }: { externalId: string; identifier: string }) => ({
      sessionId,
      projectId: 'api',
      branch: 'feat/api',
      scope: 'branch',
      provider: 'linear',
      externalId,
      identifier,
      url: `https://linear.example/${identifier}`,
      title: `Task ${identifier}`,
      createdAt: '2026-09-27T10:00:00.000Z',
    });
    store.projects = [{ id: 'api', kind: 'repo', baseBranch: 'main' }];
    store.sessionExternalTasks = {
      [sessionId]: [
        taskOf({ externalId: 'e1', identifier: 'NW-41' }),
        taskOf({ externalId: 'e2', identifier: 'NW-42' }),
        taskOf({ externalId: 'e3', identifier: 'NW-43' }),
      ],
    };
    renderRow({ row: baseRow });

    const row = screen.getByRole('listitem', { name: 'API' });
    expect(within(row).getByRole('button', { name: 'Open NW-41 on feat/api' })).toBeDefined();
    expect(within(row).queryByRole('button', { name: 'Open NW-42 on feat/api' })).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'More tasks on feat/api' }));
    expect(screen.getByText('+2')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open NW-42 on feat/api' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open NW-43 on feat/api' })).toBeDefined();
  });

  it('names the row and its action menu after the mount label', () => {
    renderRow({ row: { ...baseRow }, label: 'API on feat/api' });

    expect(screen.getByRole('listitem', { name: 'API on feat/api' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'API on feat/api actions' })).toBeDefined();
  });

  it('renders the branch decision surface when the mount reports a mismatch', () => {
    renderRow({
      row: {
        ...baseRow,
        observation: {
          mountId: 'mount-1' as MountId,
          sessionId,
          state: 'mismatch',
          recordedBranch: 'feat/api',
          observedBranch: 'feat/other',
          revision: 0,
          observedAt: '2026-09-08T10:00:00.000Z' as IsoDateTime,
        },
      },
    });

    expect(screen.getByTestId('branch-decision')).toBeDefined();
  });

  it('offers Close branch only once the pull request merged', () => {
    renderRow({
      worktreeStatus: statusWith({ mainDistance: { kind: 'known', ahead: 0, behind: 0 } }),
      row: { ...baseRow, isCompleted: true, request: { ...openRequest, state: 'merged' } },
    });

    expect(screen.getByRole('button', { name: 'Close branch for API' })).toBeDefined();
    cleanup();
    store.sessionMounts = {};
    store.mountGithub = {};
    renderRow({});
    expect(screen.queryByRole('button', { name: 'Close branch for API' })).toBeNull();
  });
});

describe('ProjectMountRow menu', () => {
  it('lists every action of the worktree, grouped, with the editors one level down', () => {
    store.detectedEditors = [{ binary: 'code', label: 'VS Code' }];
    renderRow({ worktreeStatus: statusWith({}) });
    openMenu();

    const labels = screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
    expect(labels.some((label) => label.startsWith('Open terminal'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Open in editor'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Open scripts'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Rewrite history'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Copy path'))).toBe(true);
    expect(labels.some((label) => label.startsWith('Close branch'))).toBe(true);
  });

  it('opens rewrite history for this worktree from the row menu', async () => {
    renderRow({ worktreeStatus: statusWith({}) });
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: /^Rewrite history/ }));

    await waitFor(() => expect(store.openRewriteHistory).toHaveBeenCalledWith(sessionId, '/api'));
  });

  it('keeps no hover-only terminal, scripts or sync control on the row', () => {
    renderRow({});

    expect(screen.queryByRole('button', { name: 'Open terminal for API' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open scripts for API' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Branch sync actions' })).toBeNull();
  });
});

describe('ProjectMountRow lens opening, write destination isolation', () => {
  it('opens the terminal on this row worktree, leaving the write destination alone', async () => {
    renderRow({});
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: /Open terminal/ }));

    await waitFor(() => expect(store.openMountTerminal).toHaveBeenCalledWith(sessionId, '/api'));
    expect(store.setSessionActiveMount).not.toHaveBeenCalled();
  });

  it('opens scripts scoped to this project, leaving the write destination alone', async () => {
    renderRow({});
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: /Open scripts/ }));

    await waitFor(() =>
      expect(store.setScriptsLensScope).toHaveBeenCalledWith({ scope: { projectId: 'api' } }),
    );
    expect(store.setSessionActiveMount).not.toHaveBeenCalled();
  });

  it('opens the worktree of the mount in the editor, not the first worktree of the session', async () => {
    store.detectedEditors = [];
    renderRow({});
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: /Open in editor/ }));

    await waitFor(() =>
      expect(openInEditor).toHaveBeenCalledWith({ path: '/api', editor: 'code' }),
    );
  });
});

describe('ProjectMountRow loading placeholders', () => {
  it('holds a branch placeholder instead of an empty branch cell', () => {
    renderRow({ isStatusPending: true, row: { ...baseRow, branch: '' } });

    expect(screen.getByTestId('project-branch-skeleton')).not.toBeNull();
    expect(screen.queryByTestId('branch-chip')).toBeNull();
  });

  it('leaves a folder mount without any git placeholder', () => {
    renderRow({ isStatusPending: true, row: { ...baseRow, projectKind: 'folder' } });

    expect(screen.queryByTestId('mount-status-skeleton')).toBeNull();
    expect(screen.queryByTestId('project-branch-skeleton')).toBeNull();
  });
});

describe('ProjectMountRow worktree state', () => {
  const cleanStatus = {
    branch: 'feat/api',
    head: null,
    headSubject: null,
    mainDistance: { kind: 'known', ahead: 0, behind: 0 },
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
    upstream: null,
    inProgress: null,
  } satisfies WorktreeStatus;

  it('says the state is unknown when it has not been read, never that it is clean', () => {
    renderRow({ worktreeStatus: null });

    const cell = screen.getByTestId('mount-change-state');
    expect(cell.dataset.state).toBe('unknown');
    expect(cell.textContent).toBe('Unknown');
    expect(tooltipTextOf({ element: cell })).toBe('The state of API has not been read.');
  });

  it('keeps unknown when git could not read the working tree', () => {
    renderRow({
      worktreeStatus: {
        ...cleanStatus,
        workingTree: { kind: 'unknown', reason: 'status-read-failed' },
      },
    });

    const cell = screen.getByTestId('mount-change-state');
    expect(cell.dataset.state).toBe('unknown');
    expect(cell.textContent).toBe('Unknown');
  });

  it('calls a read worktree with no modifications clean', () => {
    renderRow({ worktreeStatus: cleanStatus });

    const cell = screen.getByTestId('mount-change-state');
    expect(cell.dataset.state).toBe('clean');
    expect(cell.textContent).toBe('No changes');
  });

  it('reports local modifications before the diff numbers land', () => {
    renderRow({
      worktreeStatus: {
        ...cleanStatus,
        workingTree: {
          kind: 'known',
          staged: 1,
          unstaged: 1,
          untracked: 0,
          unmerged: 0,
          changed: 2,
        },
      },
    });

    const cell = screen.getByTestId('mount-change-state');
    expect(cell.dataset.state).toBe('modified');
    expect(cell.textContent).toBe('Modified');
    expect(tooltipTextOf({ element: cell })).toBe('API has 2 locally modified files.');
  });

  it('names the git operation in flight on the row', () => {
    renderRow({ worktreeStatus: { ...cleanStatus, inProgress: 'rebase' } });

    expect(screen.getByTitle('A rebase is in progress in API.').textContent).toBe('Rebasing');
  });

  it('leaves the row without an operation chip when nothing is running', () => {
    renderRow({ worktreeStatus: cleanStatus });

    expect(screen.queryByTitle('A rebase is in progress in API.')).toBeNull();
  });

  it('marks the main checkout apart from a worktree', () => {
    renderRow({ row: { ...baseRow, isMainCheckout: true, worktreePath: '/repo/api' } });
    expect(screen.getByTestId('mount-kind-glyph').dataset.kind).toBe('main checkout');

    cleanup();
    renderRow({ row: baseRow });
    expect(screen.getByTestId('mount-kind-glyph').dataset.kind).toBe('worktree');
  });
});

const twoMounts = () => {
  store.sessionMounts = {
    [sessionId]: [
      viewOf({ row: baseRow }),
      viewOf({ row: { ...baseRow, mountId: 'mount-2' as MountId, worktreePath: '/api-2' } }),
    ],
  };
};

describe('ProjectMountRow new turns', () => {
  it('offers to start new turns in a mount that is not the chosen one', async () => {
    twoMounts();
    store.sessionActiveMount = { [sessionId]: 'mount-2' };
    renderRow({});
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: /Start new turns here/ }));

    await waitFor(() =>
      expect(store.setSessionActiveMount).toHaveBeenCalledWith({
        sessionId,
        mountId: 'mount-1',
      }),
    );
  });

  it('offers nothing on the mount new turns already start in', () => {
    twoMounts();
    store.sessionActiveMount = { [sessionId]: 'mount-1' };
    renderRow({});
    openMenu();

    expect(screen.queryByRole('menuitem', { name: /Start new turns here/ })).toBeNull();
  });

  it('hides the choice when the session has a single mount', () => {
    renderRow({});
    openMenu();

    expect(screen.queryByRole('menuitem', { name: /Start new turns here/ })).toBeNull();
  });
});

describe('ProjectMountRow presence', () => {
  const agent = ({ id, ordinal, name }: { id: string; ordinal: number; name: string }) => ({
    id,
    ordinal,
    name,
    status: 'running',
  });

  it('shows the agents whose turn runs in this mount and opens one on click', () => {
    twoMounts();
    store.sessionPhaseRuns = {
      [sessionId]: [
        agent({ id: 'a-2', ordinal: 2, name: 'Planner' }),
        agent({ id: 'a-1', ordinal: 1, name: 'Implementer' }),
        agent({ id: 'a-3', ordinal: 3, name: 'Scout' }),
        agent({ id: 'a-4', ordinal: 4, name: 'Reviewer' }),
      ],
    };
    store.agentTurnState = {
      'a-1': { kind: 'running' },
      'a-2': { kind: 'idle' },
      'a-3': { kind: 'running' },
      'a-4': { kind: 'blocked' },
    };
    store.agentTurnDestination = {
      'a-1': { kind: 'mount', mountId: 'mount-1' },
      'a-2': { kind: 'mount', mountId: 'mount-1' },
      'a-3': { kind: 'mount', mountId: 'mount-2' },
      'a-4': { kind: 'mount', mountId: 'mount-1' },
    };
    store.sessionOpenQuestions = { [sessionId]: [{ createdByAgentId: 'a-2' }] };
    renderRow({});

    const presence = screen.getByRole('group', { name: 'Agents working in API' });
    const nodes = Array.from(presence.querySelectorAll('button')).map((node) =>
      node.getAttribute('aria-label'),
    );
    expect(nodes).toEqual(['Open Implementer', 'Open Planner', 'Open Reviewer']);
    expect(presence.textContent).toContain('3 agents here');

    fireEvent.click(screen.getByRole('button', { name: 'Open Planner' }));
    expect(store.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: sessionId, agentId: 'a-2' },
    });
  });

  it('shows no presence with a single mount', () => {
    store.sessionPhaseRuns = { [sessionId]: [agent({ id: 'a-1', ordinal: 1, name: 'Scout' })] };
    store.agentTurnState = { 'a-1': { kind: 'running' } };
    store.agentTurnDestination = { 'a-1': { kind: 'mount', mountId: 'mount-1' } };
    renderRow({});

    expect(screen.queryByTestId('mount-presence')).toBeNull();
  });
});
