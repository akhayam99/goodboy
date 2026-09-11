import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { buildStorySession, resetStorySpies, storySpies } from './storyHarness';

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
