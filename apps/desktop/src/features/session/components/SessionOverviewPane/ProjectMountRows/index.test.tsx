// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { store, useWorktreeStatuses, useWorktreeStatusPending } = vi.hoisted(() => ({
  store: {
    projects: [] as ReadonlyArray<Record<string, unknown>>,
    sessions: [] as ReadonlyArray<Record<string, unknown>>,
    sessionResolveAttempts: {},
    sessionActiveMount: {},
    sessionMounts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    sessionProjectMounts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    mountGithub: {} as Record<string, Record<string, unknown>>,
    sessionGithub: {},
    sessionResolveThreads: {},
    openReviewTarget: async () => ({ kind: 'opened' as const }),
    openRewriteHistory: () => undefined,
    mountGitlabMr: {},
    mountBitbucketPr: {},
    mountBranchObservations: {},
    prSeries: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    loadSessionMounts: vi.fn(async () => []),
    loadPrSeries: vi.fn(async () => []),
    openMountRequest: vi.fn(async () => ({ kind: 'opened' as const })),
    attachMount: vi.fn(async () => undefined),
    unmountMount: vi.fn(async () => ({ kept: false, reason: null })),
    setSessionActiveMount: vi.fn(async () => undefined),
    setScriptsLensScope: vi.fn(),
    openMountDiff: vi.fn(),
    emitNotification: vi.fn(),
    detectedEditors: [] as ReadonlyArray<{ binary: string; label: string }>,
    loadDetectedEditors: vi.fn(async () => undefined),
    sessionWorktrees: {},
    terminalTabs: {},
    scriptRuns: {},
    sessionPhaseRuns: {},
    sessionOpenQuestions: {},
    agentTurnState: {},
    agentTurnDestination: {},
    selectAgent: vi.fn(async () => undefined),
    projectScripts: {},
    mountCleanupProposals: {},
    loadMountCleanupProposals: vi.fn(async () => []),
    resolveMountCleanup: vi.fn(async () => undefined),
    settings: {} as Record<string, string>,
    saveSetting: vi.fn(async () => undefined),
    mergedThen: {} as Record<string, { head: string; mergedHead: string; newCommits: number }>,
    checkMergedThen: vi.fn(async () => undefined),
  },
  useWorktreeStatuses: vi.fn(() => new Map()),
  useWorktreeStatusPending: vi.fn(() => new Set()),
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: Object.assign(<T,>(selector: (state: typeof store) => T) => selector(store), {
    getState: () => store,
    subscribe: () => () => undefined,
  }),
  useMountDiffStats: () => new Map([['/api-one', { additions: 3, deletions: 1 }]]),
}));
vi.mock('../../../../worktree/useMountRemoteHostKind', () => ({
  useMountRemoteHostKind: () => 'github',
}));
vi.mock('../../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('../../../hooks/useWorktreeStatuses', () => ({
  useWorktreeStatuses,
  useWorktreeStatusPending,
}));
vi.mock('./MountProjectAction', () => ({
  MountProjectAction: () => <button>Add project</button>,
}));
vi.mock('./ProjectBranchChip', () => ({
  ProjectBranchChip: ({ branch }: { readonly branch: string }) => <span>{branch}</span>,
}));
vi.mock('./MountActionsMenu', () => ({ MountActionsMenu: () => null }));
vi.mock('./RemoveWorktreeAction', () => ({ RemoveWorktreeAction: () => null }));
vi.mock('./NewBranchMountAction', () => ({
  NewBranchMountAction: () => <button>New worktree</button>,
}));
vi.mock('../MountCleanupProposals', () => ({
  MountCleanupProposals: () => null,
}));

import { ProjectMountRows } from '.';

const session = { id: 'session-1', workspaceId: 'workspace-1' } as Session;

type MountParams = {
  readonly id: string;
  readonly branch: string;
  readonly path: string | null;
  readonly isAttached?: boolean;
};

const mountView = ({ id, branch, path, isAttached = true }: MountParams) => ({
  id,
  sessionId: 'session-1',
  projectId: 'api',
  mountName: 'API',
  worktreePath: path,
  lastWorktreePath: path,
  repoRoot: '/repo/api',
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  repoSlug: 'acme/api',
  isAttached,
  diskState: 'present',
  revision: 0,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
});

const githubState = ({ number, state }: { readonly number: number; readonly state: string }) => ({
  pr: {
    number,
    title: `Part ${number}`,
    url: `https://github.com/acme/api/pull/${number}`,
    state,
    isDraft: false,
  },
  repository: 'acme/api',
  host: 'github.com',
});

const seriesOfTwo = () => ({
  id: 'series-1',
  sessionId: 'session-1',
  projectId: 'api',
  name: 'restyle',
  plannedCount: 6,
  workItemIdentifier: null,
  workItemUrl: null,
  parentRequest: null,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
  members: [
    {
      id: 'member-1',
      seriesId: 'series-1',
      mountId: 'mount-1',
      branch: 'feat/one',
      ordinal: 1,
      label: '1/6',
      status: 'active',
      request: { state: 'merged' },
      createdAt: '2026-09-08T10:00:00.000Z',
      updatedAt: '2026-09-08T10:00:00.000Z',
    },
    {
      id: 'member-2',
      seriesId: 'series-1',
      mountId: 'mount-2',
      branch: 'feat/two',
      ordinal: 2,
      label: '2/6',
      status: 'active',
      request: { state: 'open' },
      createdAt: '2026-09-08T10:00:00.000Z',
      updatedAt: '2026-09-08T10:00:00.000Z',
    },
  ],
});

describe('ProjectMountRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.projects = [
      {
        id: 'api',
        workspaceId: 'workspace-1',
        name: 'API',
        kind: 'repo',
        rootPath: '/repo/api',
      },
    ];
    store.sessionMounts = {};
    store.sessionProjectMounts = {};
    store.mountGithub = {};
    store.prSeries = {};
    store.settings = {};
  });
  afterEach(cleanup);

  it('gives a project owning a single mount the same header as a project owning several', () => {
    store.projects = [
      ...store.projects,
      { id: 'web', workspaceId: 'workspace-1', name: 'WEB', kind: 'repo', rootPath: '/repo/web' },
    ];
    store.sessionMounts = {
      'session-1': [
        mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' }),
        mountView({ id: 'mount-2', branch: 'feat/two', path: '/api-two' }),
        {
          ...mountView({ id: 'mount-3', branch: 'feat/three', path: '/web-one' }),
          projectId: 'web',
        },
      ],
    };
    render(<ProjectMountRows session={session} />);

    expect(screen.getByRole('list', { name: 'API worktrees' })).toBeDefined();
    expect(screen.getByRole('list', { name: 'WEB worktrees' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'New worktree' })).toHaveLength(2);
    expect(screen.getByRole('listitem', { name: 'WEB on feat/three' })).toBeDefined();
  });

  it('gives each project its own group on shared columns, separated by rhythm and not by a box', () => {
    store.projects = [
      ...store.projects,
      { id: 'web', workspaceId: 'workspace-1', name: 'WEB', kind: 'repo', rootPath: '/repo/web' },
    ];
    store.sessionMounts = {
      'session-1': [
        mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' }),
        { ...mountView({ id: 'mount-2', branch: 'feat/two', path: '/web-one' }), projectId: 'web' },
      ],
    };
    render(<ProjectMountRows session={session} />);

    const blocks = ['API', 'WEB'].map(
      (name) => screen.getByRole('list', { name: `${name} worktrees` }).parentElement,
    );

    expect(new Set(blocks).size).toBe(2);
    for (const block of blocks) {
      expect(block).not.toBeNull();
      expect((block as HTMLElement).className).not.toContain('border');
      expect(within(block as HTMLElement).getAllByTestId('project-mount-row')).toHaveLength(1);
    }
    expect(blocks[0]?.parentElement?.className).toContain('gap-y-3');
    expect(blocks[0]?.parentElement).toBe(blocks[1]?.parentElement);
    expect(blocks[0]?.parentElement?.className).toContain('grid-cols-[');
    for (const block of blocks) {
      expect(block?.className).toContain('grid-cols-subgrid');
    }
  });

  it('renders one row per branch mount of the same project', () => {
    store.sessionMounts = {
      'session-1': [
        mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' }),
        mountView({ id: 'mount-2', branch: 'feat/two', path: '/api-two' }),
      ],
    };
    render(<ProjectMountRows session={session} />);

    const rows = screen.getAllByTestId('project-mount-row');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'API on feat/one',
      'API on feat/two',
    ]);
  });

  it('gives each row the pull request of its own mount', () => {
    store.sessionMounts = {
      'session-1': [
        mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' }),
        mountView({ id: 'mount-2', branch: 'feat/two', path: '/api-two' }),
      ],
    };
    store.mountGithub = {
      'mount-1': githubState({ number: 11, state: 'open' }),
      'mount-2': githubState({ number: 12, state: 'open' }),
    };
    render(<ProjectMountRows session={session} />);

    const [first, second] = screen.getAllByTestId('project-mount-row');
    expect(within(first as HTMLElement).getByText('PR #11')).toBeDefined();
    expect(within(second as HTMLElement).getByText('PR #12')).toBeDefined();
  });

  it('creates a request for a row that is not the active mount', async () => {
    store.sessionMounts = {
      'session-1': [
        mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' }),
        mountView({ id: 'mount-2', branch: 'feat/two', path: '/api-two' }),
      ],
    };
    useWorktreeStatuses.mockReturnValue(
      new Map([
        [
          '/api-one',
          {
            branch: 'feat/one',
            head: 'aaa',
            headSubject: 'work',
            upstream: null,
            upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
            mainDistance: { kind: 'known', ahead: 2, behind: 0 },
            workingTree: {
              kind: 'known',
              staged: 0,
              unstaged: 0,
              untracked: 0,
              unmerged: 0,
              changed: 0,
            },
            inProgress: null,
          },
        ],
      ]),
    );
    render(<ProjectMountRows session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create PR for API on feat/one' }));

    await waitFor(() =>
      expect(store.openMountRequest).toHaveBeenCalledWith({
        sessionId: 'session-1',
        mountId: 'mount-1',
        provider: 'github',
      }),
    );
  });

  it('mounts an unmounted sibling from its own row', async () => {
    store.sessionMounts = {
      'session-1': [
        mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' }),
        mountView({ id: 'mount-2', branch: 'feat/two', path: null, isAttached: false }),
      ],
    };
    render(<ProjectMountRows session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reopen for API on feat/two' }));

    await waitFor(() =>
      expect(store.attachMount).toHaveBeenCalledWith({
        sessionId: 'session-1',
        mountId: 'mount-2',
      }),
    );
  });

  it('keeps completed mounts behind a count toggle, under the branches still open', () => {
    store.sessionMounts = {
      'session-1': [
        mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' }),
        mountView({ id: 'mount-2', branch: 'feat/two', path: '/api-two' }),
      ],
    };
    store.mountGithub = { 'mount-1': githubState({ number: 11, state: 'merged' }) };
    store.prSeries = { 'session-1': [seriesOfTwo()] };
    render(<ProjectMountRows session={session} />);

    expect(screen.getAllByTestId('project-mount-row')).toHaveLength(1);
    const toggle = screen.getByRole('button', { name: /Show completed \(1\)/ });
    fireEvent.click(toggle);

    const rows = screen.getAllByTestId('project-mount-row');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'API on feat/two',
      'API on feat/one',
    ]);
  });

  it('keeps a merged branch that moved on open, with merged then its new commits', () => {
    store.sessionMounts = {
      'session-1': [mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' })],
    };
    store.mountGithub = {
      'mount-1': {
        ...githubState({ number: 11, state: 'merged' }),
        pr: { ...githubState({ number: 11, state: 'merged' }).pr, headSha: 'merged-sha' },
      },
    };
    store.mergedThen = { 'mount-1': { head: 'ccc', mergedHead: 'merged-sha', newCommits: 2 } };
    useWorktreeStatuses.mockReturnValue(
      new Map([
        [
          '/api-one',
          {
            branch: 'feat/one',
            head: 'ccc',
            headSubject: 'after the merge',
            upstream: 'origin/feat/one',
            upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
            mainDistance: { kind: 'known', ahead: 3, behind: 0 },
            workingTree: {
              kind: 'known',
              staged: 0,
              unstaged: 0,
              untracked: 0,
              unmerged: 0,
              changed: 0,
            },
            inProgress: null,
          },
        ],
      ]),
    );
    render(<ProjectMountRows session={session} />);

    expect(
      screen.getAllByTestId('project-mount-row').map((row) => row.getAttribute('aria-label')),
    ).toEqual(['API on feat/one']);
    expect(screen.getByText('Merged, then 2 new commits')).toBeDefined();
    expect(store.checkMergedThen).toHaveBeenCalledWith(
      expect.objectContaining({ mountId: 'mount-1', head: 'ccc', mergedHead: 'merged-sha' }),
    );
    store.mergedThen = {};
  });

  it('moves a branch git already merged into the base under show completed', () => {
    store.sessionMounts = {
      'session-1': [
        mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' }),
        mountView({ id: 'mount-2', branch: 'feat/two', path: '/api-two' }),
      ],
    };
    const clean = { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 };
    useWorktreeStatuses.mockReturnValue(
      new Map([
        [
          '/api-one',
          {
            branch: 'feat/one',
            head: 'aaa',
            headSubject: 'one',
            upstream: 'origin/feat/one',
            upstreamDistance: { kind: 'unknown', reason: 'upstream-gone' },
            mainDistance: { kind: 'known', ahead: 0, behind: 4 },
            workingTree: clean,
            inProgress: null,
          },
        ],
        [
          '/api-two',
          {
            branch: 'feat/two',
            head: 'bbb',
            headSubject: 'two',
            upstream: 'origin/main',
            upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
            mainDistance: { kind: 'known', ahead: 0, behind: 0 },
            workingTree: clean,
            inProgress: null,
          },
        ],
      ]),
    );
    render(<ProjectMountRows session={session} />);

    expect(
      screen.getAllByTestId('project-mount-row').map((row) => row.getAttribute('aria-label')),
    ).toEqual(['API on feat/two']);
    fireEvent.click(screen.getByRole('button', { name: /Show completed \(1\)/ }));

    const merged = screen.getByRole('listitem', { name: 'API on feat/one' });
    expect(within(merged).getByText('Merged')).toBeDefined();
    useWorktreeStatuses.mockReturnValue(new Map());
  });

  it('orders the mounts of a series by the position it declares', () => {
    store.sessionMounts = {
      'session-1': [
        mountView({ id: 'mount-2', branch: 'feat/two', path: '/api-two' }),
        mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' }),
      ],
    };
    store.prSeries = { 'session-1': [seriesOfTwo()] };
    render(<ProjectMountRows session={session} />);

    const rows = screen.getAllByTestId('project-mount-row');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'API on feat/one',
      'API on feat/two',
    ]);
  });

  it('names the split on the group and the part on the row', () => {
    store.sessionMounts = {
      'session-1': [
        mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' }),
        mountView({ id: 'mount-2', branch: 'feat/two', path: '/api-two' }),
      ],
    };
    store.prSeries = { 'session-1': [seriesOfTwo()] };
    render(<ProjectMountRows session={session} />);

    expect(screen.getByText('restyle')).toBeDefined();
    expect(screen.getByText('Part 2/6')).toBeDefined();
    expect(screen.queryByText(/of 6 created/)).toBeNull();
  });

  it('keeps the secondary commands of every row reachable by keyboard', () => {
    store.sessionMounts = {
      'session-1': [
        mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' }),
        mountView({ id: 'mount-2', branch: 'feat/two', path: '/api-two' }),
      ],
    };
    render(<ProjectMountRows session={session} />);

    const menu = screen.getByRole('button', { name: 'API on feat/two actions' });
    menu.focus();

    expect(document.activeElement).toBe(menu);
  });

  it('keeps an unmounted branch with open work out of the completed disclosure', () => {
    store.sessionMounts = {
      'session-1': [
        mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' }),
        mountView({ id: 'mount-2', branch: 'feat/two', path: null, isAttached: false }),
      ],
    };
    render(<ProjectMountRows session={session} />);

    expect(screen.queryByRole('button', { name: /Completed/ })).toBeNull();
    expect(screen.getAllByTestId('project-mount-row')).toHaveLength(2);
  });

  it('says where turns run once it knows the session has no project', () => {
    store.sessionProjectMounts = { 'session-1': [] };
    render(<ProjectMountRows session={session} />);

    expect(screen.getByText('Projects')).toBeDefined();
    expect(
      screen.getByText('No project yet. Turns run in the session folder until you add one.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add project' })).toBeDefined();
  });

  it('stays quiet while the projects of the session are still loading', () => {
    render(<ProjectMountRows session={session} />);

    expect(screen.queryByText(/No project yet/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Add project' })).toBeDefined();
  });

  it('keeps the mount action in the section header when mounts exist', () => {
    store.sessionProjectMounts = {
      'session-1': [
        {
          mountId: 'mount-1',
          projectId: 'api',
          mountName: 'API',
          branch: 'feat/api',
          worktreePath: '/api',
          repoRoot: '/repo/api',
        },
      ],
    };
    render(<ProjectMountRows session={session} />);

    expect(screen.getByRole('button', { name: 'Add project' })).toBeDefined();
    expect(screen.getByTestId('project-mount-row')).toBeDefined();
    expect(screen.queryByText(/No project yet/)).toBeNull();
  });

  it('explains the Projects block once a worktree exists, and dismisses it for good past the second', () => {
    store.sessionMounts = {
      'session-1': [mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' })],
    };
    const view = render(<ProjectMountRows session={session} />);
    expect(screen.getByText(/Where this session works/)).toBeDefined();
    expect(store.saveSetting).not.toHaveBeenCalled();

    view.unmount();
    store.sessionMounts = {
      'session-1': [
        mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' }),
        mountView({ id: 'mount-2', branch: 'feat/two', path: '/api-two' }),
      ],
    };
    render(<ProjectMountRows session={session} />);
    expect(store.saveSetting).toHaveBeenCalledWith('projects.hint.dismissed', 'true');
  });

  it('never shows the explainer once the dismissal flag is set', () => {
    store.settings = { 'projects.hint.dismissed': 'true' };
    store.sessionMounts = {
      'session-1': [mountView({ id: 'mount-1', branch: 'feat/one', path: '/api-one' })],
    };
    render(<ProjectMountRows session={session} />);

    expect(screen.queryByText(/Where this session works/)).toBeNull();
  });
});
