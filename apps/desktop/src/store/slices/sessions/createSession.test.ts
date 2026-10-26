import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, Workspace, WorkspaceId } from '@goodboy/types';
import { nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  resetStorySpies,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/skills/skills', async () =>
  (await import('../../storyHarness')).skillsModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const MISSING_WORKSPACE_ID = nextWorkspaceId();

let useAppStore: StoryStore;

type StartSessionParams = {
  readonly workspaceId: WorkspaceId;
  readonly workspace: Workspace;
};

const startSession = async ({ workspaceId, workspace }: StartSessionParams): Promise<Session> => {
  storySpies.getWorkspaceById.mockResolvedValue(workspace);
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    projects: [],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
  });
  const { session } = await useAppStore
    .getState()
    .createSession({ workspaceId, goal: 'Reconcile the payments-api ledger', omitGoalSlot: true });
  return session;
};

type ExpectPersistedParams = {
  readonly permissionMode: Session['permissionMode'];
};

const expectPersisted = ({ permissionMode }: ExpectPersistedParams): void => {
  expect(storySpies.insertSession).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ permissionMode }),
  );
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  resetStorySpies();
  stubStoryInvoke({});
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  storySpies.listProjectsForWorkspace.mockResolvedValue([]);
});

describe('createSession permission mode', () => {
  it('takes the workspace permission default when the workspace names one', async () => {
    const session = await startSession({
      workspaceId: WORKSPACE_ID,
      workspace: buildStoryWorkspace({ id: WORKSPACE_ID, defaultPermissionMode: 'plan' }),
    });

    expect(session.permissionMode).toBe('plan');
    expectPersisted({ permissionMode: 'plan' });
  });

  it('falls back to Ask first when the workspace names no default', async () => {
    const session = await startSession({
      workspaceId: WORKSPACE_ID,
      workspace: buildStoryWorkspace({ id: WORKSPACE_ID }),
    });

    expect(session.permissionMode).toBe('default');
    expectPersisted({ permissionMode: 'default' });
  });

  it('falls back to Ask first when the workspace is not loaded', async () => {
    const session = await startSession({
      workspaceId: MISSING_WORKSPACE_ID,
      workspace: buildStoryWorkspace({ id: WORKSPACE_ID, defaultPermissionMode: 'plan' }),
    });

    expect(session.permissionMode).toBe('default');
    expectPersisted({ permissionMode: 'default' });
  });
});
