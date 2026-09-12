import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
  ProjectId,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import {
  buildStoryAgent,
  buildStorySession,
  resetStorySpies,
  storyResolveQueries,
  storySpies,
} from './storyHarness';
import { mountCleanupBlockers } from './slices/mount-cleanup/cleanupPolicy';
import { requireMountTarget } from './slices/resolve/mountTarget';
import { listWriteDestinationCandidates } from './slices/project-mounts/writeDestination';
import { initialState } from './store';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

const WORKSPACE_ID = 'workspace-cardinality' as WorkspaceId;
const SESSION_ID = 'session-cardinality' as SessionId;
const PROJECT_A = 'project-a' as ProjectId;
const PROJECT_B = 'project-b' as ProjectId;
const MOUNT_A1 = 'mount-a-1' as MountId;
const MOUNT_A2 = 'mount-a-2' as MountId;
const MOUNT_B3 = 'mount-b-3' as MountId;
const NOW = '2026-09-01T00:00:00.000Z' as IsoDateTime;

const project = ({ id, name }: { readonly id: ProjectId; readonly name: string }) => ({
  id,
  workspaceId: WORKSPACE_ID,
  name,
  rootPath: `/repos/${name}`,
  kind: 'repo' as const,
  overrides: {},
  createdAt: NOW,
  updatedAt: NOW,
});

const row = ({
  id,
  projectId,
  branch,
  parallelIndex,
}: {
  readonly id: MountId;
  readonly projectId: ProjectId;
  readonly branch: string;
  readonly parallelIndex: number;
}) => ({
  id,
  sessionId: SESSION_ID,
  worktreePath: `/repos/app/.goodboy/worktrees/${id}`,
  branch,
  parallelIndex,
  projectId,
  mountName: projectId === PROJECT_A ? 'a' : 'b',
  revision: 3,
  createdAt: Date.parse(NOW),
});

const ROWS = [
  row({ id: MOUNT_A1, projectId: PROJECT_A, branch: 'ak/one', parallelIndex: 1 }),
  row({ id: MOUNT_A2, projectId: PROJECT_A, branch: 'ak/two', parallelIndex: 2 }),
  row({ id: MOUNT_B3, projectId: PROJECT_B, branch: 'ak/three', parallelIndex: 3 }),
];

const sessionWith = (activeMountId?: MountId): Session =>
  buildStorySession({
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'ship the split',
    state: { kind: 'idle', lastActivityAt: NOW },
    ...(activeMountId === undefined ? {} : { activeMountId }),
  });

const OTHER_SESSION: Session = buildStorySession({
  id: 'session-untouched' as SessionId,
  workspaceId: WORKSPACE_ID,
  goal: 'stay closed',
  state: { kind: 'idle', lastActivityAt: NOW },
});

const RESOLVER_ID = 'agent-resolver' as AgentId;

const resolverAgent = (): Agent =>
  buildStoryAgent({ id: RESOLVER_ID, sessionId: SESSION_ID, name: 'resolver', kind: 'resolver' });

const pathOf = ({ mountId }: { readonly mountId: MountId }): string =>
  `/repos/app/.goodboy/worktrees/${mountId}`;

type StoreModule = typeof import('./store');
let useAppStore: StoreModule['useAppStore'];

const seed = async ({
  session,
  rows,
}: {
  readonly session: Session;
  readonly rows: ReadonlyArray<ReturnType<typeof row>>;
}) => {
  const db = await import('@goodboy/db');
  storySpies.listProjectsForWorkspace.mockResolvedValue([
    project({ id: PROJECT_A, name: 'a' }),
    project({ id: PROJECT_B, name: 'b' }),
  ] as never);
  vi.mocked(db.listSessionsForWorkspace).mockResolvedValue([session, OTHER_SESSION] as never);
  vi.mocked(db.listWorktreesForSessions).mockResolvedValue(new Map([[SESSION_ID, rows]]) as never);
};

beforeAll(async () => {
  ({ useAppStore } = await import('./store'));
}, 60_000);

beforeEach(() => {
  resetStorySpies();
});

describe('story: two mounts of one project survive a restart', () => {
  it('keeps every mount, its grouping and the persisted destination', async () => {
    await seed({ session: sessionWith(MOUNT_A2), rows: ROWS });

    await useAppStore.getState().setCurrentWorkspace(WORKSPACE_ID);

    const state = useAppStore.getState();
    const mounts = state.sessionProjectMounts[SESSION_ID] ?? [];
    expect(mounts.map((mount) => mount.mountId)).toEqual([MOUNT_A1, MOUNT_A2, MOUNT_B3]);
    expect(
      mounts.filter((mount) => mount.projectId === PROJECT_A).map((mount) => mount.worktreePath),
    ).toEqual([
      '/repos/app/.goodboy/worktrees/mount-a-1',
      '/repos/app/.goodboy/worktrees/mount-a-2',
    ]);
    expect(mounts.filter((mount) => mount.projectId === PROJECT_B)).toHaveLength(1);
    expect(state.sessionActiveMount[SESSION_ID]).toBe(MOUNT_A2);
    expect(state.sessionActiveProject[SESSION_ID]).toBe(PROJECT_A);
    expect(state.sessionBranches[SESSION_ID]).toBe('ak/two');
  });

  it('asks for a choice instead of writing into the first mount', async () => {
    await seed({ session: sessionWith(), rows: ROWS });

    await useAppStore.getState().setCurrentWorkspace(WORKSPACE_ID);

    const state = useAppStore.getState();
    expect(state.sessionActiveMount[SESSION_ID]).toBeNull();
    expect(state.sessionBranches[SESSION_ID]).toBeUndefined();
    expect(storySpies.updateSessionWriteDestination).not.toHaveBeenCalled();
    await expect(
      useAppStore.getState().sendTurn({ sessionId: SESSION_ID, content: 'go' }),
    ).rejects.toThrow(/Choose the branch mount/);
  });

  it('repairs and persists the choice when the session holds a single mount', async () => {
    await seed({ session: sessionWith(), rows: [ROWS[0] as ReturnType<typeof row>] });

    await useAppStore.getState().setCurrentWorkspace(WORKSPACE_ID);

    const state = useAppStore.getState();
    expect(state.sessionActiveMount[SESSION_ID]).toBe(MOUNT_A1);
    expect(state.sessions.find((candidate) => candidate.id === SESSION_ID)?.activeMountId).toBe(
      MOUNT_A1,
    );
    expect(storySpies.updateSessionWriteDestination).toHaveBeenCalledWith({
      db: expect.anything(),
      sessionId: SESSION_ID,
      mountId: MOUNT_A1,
    });
  });
});

describe('story: a queued fix stays on the worktree it named', () => {
  const mountRow = ({
    id,
    projectId,
    branch,
    parallelIndex,
  }: {
    readonly id: MountId;
    readonly projectId: ProjectId;
    readonly branch: string;
    readonly parallelIndex: number;
  }) => ({
    id,
    sessionId: SESSION_ID,
    projectId,
    worktreePath: pathOf({ mountId: id }),
    lastWorktreePath: pathOf({ mountId: id }),
    branch,
    baseBranch: null,
    parallelIndex,
    mountName: projectId === PROJECT_A ? 'a' : 'b',
    repoSlug: null,
    isAttached: true,
    diskState: 'present',
    revision: 3,
    createdAt: NOW,
    updatedAt: NOW,
  });

  const openSession = () => {
    useAppStore.setState({ sessionPhaseRuns: { [SESSION_ID]: [resolverAgent()] } });
  };

  const restart = async ({ session }: { readonly session: Session }) => {
    await seed({ session, rows: ROWS });
    useAppStore.setState(initialState);
    await useAppStore.getState().setCurrentWorkspace(WORKSPACE_ID);
    openSession();
  };

  it('queues on the chosen mount, drains there after the choice moves, and survives removal', async () => {
    await seed({ session: sessionWith(MOUNT_A2), rows: ROWS });
    await useAppStore.getState().setCurrentWorkspace(WORKSPACE_ID);
    openSession();

    const target = requireMountTarget({
      get: useAppStore.getState,
      sessionId: SESSION_ID,
    });
    expect(target).toEqual({
      mountId: MOUNT_A2,
      mountRevision: 3,
      worktreePath: pathOf({ mountId: MOUNT_A2 }),
    });

    const attemptId = await useAppStore.getState().recordResolveAttempt({
      sessionId: SESSION_ID,
      agent: resolverAgent(),
      provider: 'anthropic',
      model: 'claude-opus-5',
      effort: null,
      instructions: 'fix the review comment',
      phase: 'queued',
      mountTarget: target,
    });
    expect(storyResolveQueries.insertResolveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: expect.objectContaining({
          id: attemptId,
          mountTarget: {
            mountId: MOUNT_A2,
            mountRevision: 3,
            worktreePath: pathOf({ mountId: MOUNT_A2 }),
          },
        }),
      }),
    );

    await restart({ session: sessionWith(MOUNT_A2) });

    const restored = useAppStore.getState();
    expect((restored.sessionProjectMounts[SESSION_ID] ?? []).map((mount) => mount.mountId)).toEqual(
      [MOUNT_A1, MOUNT_A2, MOUNT_B3],
    );
    expect(restored.sessionActiveMount[SESSION_ID]).toBe(MOUNT_A2);
    expect(restored.sessionBranches[SESSION_ID]).toBe('ak/two');
    const candidates = listWriteDestinationCandidates({
      mounts: restored.sessionProjectMounts[SESSION_ID] ?? [],
      projects: restored.projects,
    });
    expect(candidates).toHaveLength(3);
    expect(
      candidates.filter(
        (candidate) => candidate.mountId === restored.sessionActiveMount[SESSION_ID],
      ),
    ).toHaveLength(1);

    await useAppStore
      .getState()
      .setSessionActiveMount({ sessionId: SESSION_ID, mountId: MOUNT_B3 });
    expect(useAppStore.getState().sessionActiveMount[SESSION_ID]).toBe(MOUNT_B3);

    await useAppStore.getState().drainResolveQueue({ sessionId: SESSION_ID });

    expect(storySpies.acquireWorktreeWriter.mock.calls.map(([args]) => args)).toEqual([
      { path: pathOf({ mountId: MOUNT_A2 }), holder: RESOLVER_ID },
    ]);
    expect(
      mountCleanupBlockers({
        state: useAppStore.getState(),
        sessionId: SESSION_ID,
        mountId: MOUNT_A1,
        worktreePath: pathOf({ mountId: MOUNT_A1 }),
      }),
    ).toEqual([]);

    storySpies.listSessionMounts.mockResolvedValue(
      ROWS.map((entry) =>
        mountRow({
          id: entry.id,
          projectId: entry.projectId,
          branch: entry.branch,
          parallelIndex: entry.parallelIndex,
        }),
      ) as never,
    );
    await useAppStore
      .getState()
      .removeMountWorktree({ sessionId: SESSION_ID, mountId: MOUNT_A1, mode: 'safe' });

    expect(storySpies.removeWorktreeChecked).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: pathOf({ mountId: MOUNT_A1 }) }),
    );
    const afterRemoval = useAppStore.getState();
    expect((afterRemoval.sessionMounts[SESSION_ID] ?? []).map((view) => view.id)).toEqual([
      MOUNT_A1,
      MOUNT_A2,
      MOUNT_B3,
    ]);
    expect(afterRemoval.sessionActiveMount[SESSION_ID]).toBe(MOUNT_B3);

    await restart({ session: sessionWith(MOUNT_B3) });

    const rebooted = useAppStore.getState();
    expect(rebooted.sessionActiveMount[SESSION_ID]).toBe(MOUNT_B3);
    expect(rebooted.sessionActiveProject[SESSION_ID]).toBe(PROJECT_B);
    expect((rebooted.sessionProjectMounts[SESSION_ID] ?? []).map((mount) => mount.mountId)).toEqual(
      [MOUNT_A1, MOUNT_A2, MOUNT_B3],
    );
  });
});
