// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  WorkspaceId,
  WorktreeStatus,
} from '@goodboy/types';
import type { OverflowMenuItem } from '@goodboy/ui';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';

type RemoveWorktreeProps = {
  readonly label: string;
};

type MenuProps = {
  readonly menuLabel?: string;
  readonly items?: ReadonlyArray<OverflowMenuItem>;
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
    projects: [] as ReadonlyArray<{ id: string; baseBranch?: string | null }>,
    emitNotification: vi.fn(),
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    detectedEditors: [] as ReadonlyArray<{ binary: string; label: string }>,
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
    selectAgent: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));
vi.mock('./ProjectBranchChip', () => ({
  ProjectBranchChip: () => <span data-testid="branch-chip" />,
}));
vi.mock('./ProjectSyncControl', () => ({
  ProjectSyncControl: () => <span data-testid="sync-control" />,
}));
vi.mock('./MountActionsMenu', () => ({
  MountActionsMenu: ({ menuLabel, items = [] }: MenuProps) => (
    <span data-testid="detach-menu">
      <span data-testid="menu-label">{menuLabel}</span>
      {items.map((item) =>
        item.kind === 'item' ? (
          <button key={item.key} type="button" role="menuitem" onClick={item.onClick}>
            {item.label}
          </button>
        ) : null,
      )}
    </span>
  ),
}));
vi.mock('./RemoveWorktreeAction', () => ({
  RemoveWorktreeAction: ({ label }: RemoveWorktreeProps) => (
    <button type="button" aria-label={`Remove the worktree for ${label}`}>
      Remove worktree
    </button>
  ),
}));
vi.mock('./MountBranchDecision', () => ({
  MountBranchDecision: () => <div data-testid="branch-decision" />,
}));
vi.mock('../../../../worktree/useMountRemoteHostKind', () => ({
  useMountRemoteHostKind: () => remoteKind.current,
}));
vi.mock('../../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('../../../../../shared/lib/editor', () => ({
  openInEditor: vi.fn(async () => undefined),
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

const renderRow = ({
  diffStat = null,
  worktreeStatus = null,
  isStatusPending = false,
  row = baseRow,
  label = 'API',
  onSelectLens = vi.fn(),
}: {
  readonly diffStat?: { additions: number; deletions: number } | null;
  readonly worktreeStatus?: WorktreeStatus | null;
  readonly isStatusPending?: boolean;
  readonly row?: MountRowView;
  readonly label?: string;
  readonly onSelectLens?: (lens: string) => void;
}) =>
  render(
    <ul>
      <ProjectMountRow
        sessionId={sessionId}
        row={row}
        label={label}
        workspaceId={'ws-1' as WorkspaceId}
        diffStat={diffStat}
        worktreeStatus={worktreeStatus}
        isStatusPending={isStatusPending}
        onSelectLens={onSelectLens}
      />
    </ul>,
  );

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
  store.sessionOpenQuestions = {};
  store.agentTurnState = {};
  store.agentTurnDestination = {};
});

afterEach(cleanup);

describe('ProjectMountRow request action', () => {
  it('opens the pull request for this mount in review, without touching the window bus', async () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-github-session', listener);
    renderRow({ diffStat: { additions: 3, deletions: 1 } });

    fireEvent.click(screen.getByRole('button', { name: 'Create a PR for API' }));

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

  it('blocks create pr while an agent is opening one', () => {
    store.sessionPhaseRuns = {
      [sessionId]: [{ name: 'open pull request', status: 'running' }],
    };
    renderRow({ diffStat: { additions: 3, deletions: 1 } });

    const action = screen.getByRole('button', { name: 'An agent is opening a PR for API' });
    expect(action.hasAttribute('disabled')).toBe(true);
    expect(action.textContent).toBe('Opening PR…');
  });

  it('hides create pr without changes', () => {
    renderRow({ diffStat: null });
    expect(screen.queryByRole('button', { name: 'Create a PR for API' })).toBeNull();
  });

  it('shows the request of this mount instead of the create action', async () => {
    renderRow({
      diffStat: { additions: 3, deletions: 1 },
      row: {
        ...baseRow,
        request: {
          provider: 'github',
          identity: null,
          number: 12,
          state: 'open',
          isDraft: false,
          url: 'https://github.com/acme/api/pull/12',
          title: 'Split one',
          label: 'PR #12',
        },
      },
    });

    expect(screen.queryByRole('button', { name: 'Create a PR for API' })).toBeNull();
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
    renderRow({ diffStat: { additions: 1, deletions: 0 } });
    expect(screen.getByRole('button', { name: 'Create a PR for API' }).textContent).toBe(
      'Create MR',
    );
  });

  it('hides the action when the remote kind is unknown', () => {
    remoteKind.current = null;
    renderRow({ diffStat: { additions: 1, deletions: 0 } });
    expect(screen.queryByRole('button', { name: 'Create a PR for API' })).toBeNull();
  });
});

describe('ProjectMountRow availability', () => {
  const detached: MountRowView = {
    ...baseRow,
    isAttached: false,
    worktreePath: null,
    isOnDisk: true,
  };

  it('offers mount on an unmounted row and states the kept files in the state slot', async () => {
    renderRow({ row: detached });

    expect(screen.getByText('Files kept')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen API' }));

    await waitFor(() =>
      expect(store.attachMount).toHaveBeenCalledWith({ sessionId, mountId: 'mount-1' }),
    );
  });

  it('hides the worktree tools of an unmounted row', () => {
    renderRow({ row: detached });

    expect(screen.queryByRole('button', { name: 'Open terminal for API' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Open terminal' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'VS Code' })).toBeNull();
  });

  it('names the row and its action menu after the mount label', () => {
    renderRow({ row: { ...baseRow }, label: 'API on feat/api' });

    expect(screen.getByRole('listitem', { name: 'API on feat/api' })).toBeDefined();
    expect(screen.getByTestId('menu-label').textContent).toBe('API on feat/api actions');
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

  it('offers worktree removal only for a completed attached row', () => {
    renderRow({ row: { ...baseRow, isCompleted: true } });

    expect(screen.getByRole('button', { name: 'Remove the worktree for API' })).toBeDefined();
    cleanup();
    renderRow({});
    expect(screen.queryByRole('button', { name: 'Remove the worktree for API' })).toBeNull();
  });
});

const openRequest: MountRowView['request'] = {
  provider: 'github',
  identity: null,
  number: 12,
  state: 'open',
  isDraft: false,
  url: 'https://github.com/acme/api/pull/12',
  title: 'Split one',
  label: 'PR #12',
};

const slotsOf = (): ReadonlyArray<Element> =>
  Array.from(screen.getByTestId('project-mount-cells').children);

describe('ProjectMountRow column grammar', () => {
  const detached: MountRowView = { ...baseRow, isAttached: false, worktreePath: null };

  it('fills the seven grid columns in the same order in every state', () => {
    renderRow({
      diffStat: { additions: 3, deletions: 1 },
      row: { ...baseRow, request: openRequest },
    });
    const attached = slotsOf();
    cleanup();
    renderRow({ row: detached });
    const unmounted = slotsOf();

    expect(attached).toHaveLength(7);
    expect(unmounted).toHaveLength(7);
    expect(screen.getByTestId('project-mount-cells').className).toContain('grid-cols-subgrid');
  });

  it('leads with the branch', () => {
    renderRow({ row: { ...baseRow, request: openRequest } });
    const [branch] = slotsOf();

    expect(branch?.querySelector('[data-testid="branch-chip"]')).not.toBeNull();
  });

  it('renders an empty cell with no width of its own where a column has nothing', () => {
    renderRow({ row: baseRow });
    const series = slotsOf()[1];
    expect(series?.tagName).toBe('SPAN');
    expect(series?.className).toBe('');
    cleanup();

    renderRow({
      row: {
        ...baseRow,
        series: {
          seriesId: 'series-1',
          name: 'restyle',
          position: 3,
          plannedCount: 6,
          label: '3/6',
        },
      },
    });

    expect(slotsOf()[1]?.textContent).toBe('Part 3/6');
  });

  it('holds the state of a row in one cell, request state and number together', () => {
    renderRow({
      diffStat: { additions: 3, deletions: 1 },
      row: { ...baseRow, request: openRequest },
    });
    expect(slotsOf()[4]?.textContent).toBe('In review·#12');
    cleanup();

    renderRow({ row: detached });
    expect(slotsOf()[4]?.textContent).toBe('Files kept');
  });

  it('keeps the mount action in the action cell and the menu last', () => {
    renderRow({ row: detached });
    const slots = slotsOf();

    expect(slots[5]?.textContent).toBe('Reopen');
    expect(slots.at(-1)?.querySelector('[data-testid="detach-menu"]')).not.toBeNull();
  });

  it('hides sync and diff in a narrow container without dropping their cells', () => {
    renderRow({ diffStat: { additions: 3, deletions: 1 } });
    const slots = slotsOf();

    expect(slots[2]?.className).toContain('@max-[36rem]:*:hidden');
    expect(slots[3]?.className).toContain('@max-[36rem]:*:hidden');
  });
});

describe('ProjectMountRow menu', () => {
  it('lists terminal, scripts and the editors of this mount in the row menu', () => {
    renderRow({});

    expect(screen.getByRole('menuitem', { name: 'Open terminal' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Open scripts' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'VS Code' })).toBeDefined();
  });

  it('opens the worktree of the mount, not the first worktree of the session', () => {
    renderRow({});

    fireEvent.click(screen.getByRole('menuitem', { name: 'VS Code' }));

    expect(openInEditor).toHaveBeenCalledWith('/api', 'code');
  });

  it('keeps no hover-only class on the menu and moves the editor off the row', () => {
    renderRow({});

    expect(screen.queryByRole('button', { name: 'Open the folder of API' })).toBeNull();
    expect(screen.getByTestId('detach-menu').closest('.opacity-0')).toBeNull();
  });
});

describe('ProjectMountRow lens opening, write destination isolation', () => {
  it('opens the terminal on this row worktree through its own scope, leaving the write destination alone', () => {
    const onSelectLens = vi.fn();
    renderRow({ onSelectLens });

    fireEvent.click(screen.getByRole('button', { name: 'Open terminal for API' }));

    expect(store.openMountTerminal).toHaveBeenCalledWith(sessionId, '/api');
    expect(store.setSessionActiveMount).not.toHaveBeenCalled();
    expect(onSelectLens).not.toHaveBeenCalled();
  });

  it('opens scripts scoped to this project, leaving the write destination alone', () => {
    const onSelectLens = vi.fn();
    renderRow({ onSelectLens });

    fireEvent.click(screen.getByRole('button', { name: 'Open scripts for API' }));

    expect(store.setScriptsLensScope).toHaveBeenCalledWith({ scope: { projectId: 'api' } });
    expect(onSelectLens).toHaveBeenCalledWith('scripts');
    expect(store.setSessionActiveMount).not.toHaveBeenCalled();
  });
});

describe('ProjectMountRow activity dots', () => {
  it('marks the terminal icon when a live tab belongs to the project', () => {
    store.terminalTabs = {
      [sessionId]: [{ id: `${sessionId}::t1`, projectId: 'api', status: 'running' }],
    };
    renderRow({});
    expect(screen.getByTestId('terminal-activity-dot')).toBeDefined();
    expect(screen.queryByTestId('scripts-activity-dot')).toBeNull();
  });

  it('leaves the terminal icon bare when the live tab belongs to another project', () => {
    store.terminalTabs = {
      [sessionId]: [{ id: `${sessionId}::t1`, projectId: 'web', status: 'running' }],
    };
    renderRow({});
    expect(screen.queryByTestId('terminal-activity-dot')).toBeNull();
  });

  it('marks the scripts icon when a pending run belongs to the project', () => {
    store.scriptRuns = { [sessionId]: { 'script-api': { status: 'pending' } } };
    renderRow({});
    expect(screen.getByTestId('scripts-activity-dot')).toBeDefined();
    expect(screen.queryByTestId('terminal-activity-dot')).toBeNull();
  });

  it('carries the counts in the tooltips', () => {
    store.terminalTabs = {
      [sessionId]: [
        { id: `${sessionId}::t1`, projectId: 'api', status: 'running' },
        { id: `${sessionId}::t2`, projectId: 'api', status: 'running' },
        { id: `${sessionId}::t3`, projectId: 'web', status: 'running' },
      ],
    };
    store.scriptRuns = { [sessionId]: { 'script-api': { status: 'pending' } } };
    renderRow({});

    expect(
      tooltipTextOf({ element: screen.getByRole('button', { name: 'Open terminal for API' }) }),
    ).toBe('Open terminal in API, 2 running');
    expect(
      tooltipTextOf({ element: screen.getByRole('button', { name: 'Open scripts for API' }) }),
    ).toBe('Open scripts for API, 1 running');
  });

  it('keeps the plain tooltips when nothing runs for the project', () => {
    renderRow({});

    expect(
      tooltipTextOf({ element: screen.getByRole('button', { name: 'Open terminal for API' }) }),
    ).toBe('Open terminal in API');
    expect(
      tooltipTextOf({ element: screen.getByRole('button', { name: 'Open scripts for API' }) }),
    ).toBe('Open scripts for API');
  });
});

describe('ProjectMountRow loading placeholders', () => {
  const status = {
    branch: 'feat/api',
    head: null,
    headSubject: null,
    mainDistance: { kind: 'known', ahead: 0, behind: 0 },
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
    upstream: null,
    inProgress: null,
  } satisfies WorktreeStatus;

  it('holds a distance placeholder while the git status is still pending', () => {
    renderRow({ isStatusPending: true });

    expect(screen.getByTestId('project-distance-skeleton')).not.toBeNull();
    expect(screen.queryByTestId('sync-control')).toBeNull();
  });

  it('swaps the placeholder for the sync control once the status lands', () => {
    renderRow({ worktreeStatus: status });

    expect(screen.queryByTestId('project-distance-skeleton')).toBeNull();
    expect(screen.getByTestId('sync-control')).not.toBeNull();
  });

  it('hides the sync control only for a completed row', () => {
    renderRow({ worktreeStatus: status, row: { ...baseRow, isCompleted: true } });
    expect(screen.queryByTestId('sync-control')).toBeNull();
    cleanup();

    renderRow({ worktreeStatus: status });
    expect(screen.getByTestId('sync-control')).not.toBeNull();
  });

  it('holds a branch placeholder instead of an empty branch cell', () => {
    renderRow({ isStatusPending: true, row: { ...baseRow, branch: '' } });

    expect(screen.getByTestId('project-branch-skeleton')).not.toBeNull();
    expect(screen.queryByTestId('branch-chip')).toBeNull();
  });

  it('leaves a folder mount without any git placeholder', () => {
    renderRow({ isStatusPending: true, row: { ...baseRow, projectKind: 'folder' } });

    expect(screen.queryByTestId('project-distance-skeleton')).toBeNull();
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
  store.sessionProjectMounts = {
    [sessionId]: [
      { mountId: 'mount-1', projectId: 'api', worktreePath: '/api', isAttached: true },
      { mountId: 'mount-2', projectId: 'api', worktreePath: '/api-2', isAttached: true },
    ],
  };
};

describe('ProjectMountRow new turns', () => {
  it('offers to start new turns in a mount that is not the chosen one', async () => {
    twoMounts();
    store.sessionActiveMount = { [sessionId]: 'mount-2' };
    renderRow({});

    fireEvent.click(screen.getByRole('menuitem', { name: 'Start new turns here' }));

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

    expect(screen.queryByRole('menuitem', { name: 'Start new turns here' })).toBeNull();
  });

  it('hides the choice when the session has a single mount', () => {
    store.sessionProjectMounts = {
      [sessionId]: [
        { mountId: 'mount-1', projectId: 'api', worktreePath: '/api', isAttached: true },
      ],
    };
    renderRow({});

    expect(screen.queryByRole('menuitem', { name: 'Start new turns here' })).toBeNull();
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
    expect(store.selectAgent).toHaveBeenCalledWith(sessionId, 'a-2');
  });

  it('shows no presence with a single mount', () => {
    store.sessionProjectMounts = {
      [sessionId]: [
        { mountId: 'mount-1', projectId: 'api', worktreePath: '/api', isAttached: true },
      ],
    };
    store.sessionPhaseRuns = { [sessionId]: [agent({ id: 'a-1', ordinal: 1, name: 'Scout' })] };
    store.agentTurnState = { 'a-1': { kind: 'running' } };
    store.agentTurnDestination = { 'a-1': { kind: 'mount', mountId: 'mount-1' } };
    renderRow({});

    expect(screen.queryByTestId('mount-presence')).toBeNull();
  });
});
