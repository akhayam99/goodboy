import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionWorktree } from '@goodboy/db';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type ProviderRunId,
  type Session,
  type SessionId,
  type SessionMountView,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  buildStoryAgent,
  buildStorySession,
  connectedAnthropicState,
  emptyTurnStream,
  resetStorySpies,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  type StoryStore,
} from './storyHarness';
import { queueMountContinuation } from './slices/turn/mountContinuations';
import { selectRunStepMountId } from './slices/workflows/runMount/selectRunStepMountId';

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

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-northwind' });
const SESSION_ID = brandId<SessionId>({ value: 'session-ledger-core' });
const PROJECT_ID = brandId<ProjectId>({ value: 'project-ledger-core' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'run-ledger-core' });
const MOUNT_A = brandId<MountId>({ value: 'mount-refactor' });
const MOUNT_B = brandId<MountId>({ value: 'mount-fix' });
const NOW = brandId<IsoDateTime>({ value: '2026-10-29T00:00:00.000Z' });

const pathOf = ({ mountId }: { readonly mountId: MountId }): string =>
  `/repos/ledger-core/.goodboy/worktrees/${mountId}`;

const row = ({
  id,
  branch,
  parallelIndex,
}: {
  readonly id: MountId;
  readonly branch: string;
  readonly parallelIndex: number;
}): SessionWorktree => ({
  id,
  sessionId: SESSION_ID,
  worktreePath: pathOf({ mountId: id }),
  branch,
  parallelIndex,
  projectId: PROJECT_ID,
  mountName: 'ledger-core',
  revision: 3,
  createdAt: Date.parse(NOW),
});

const ROWS = [
  row({ id: MOUNT_A, branch: 'ak/refactor-ledger', parallelIndex: 1 }),
  row({ id: MOUNT_B, branch: 'ak/fix-notify-relay', parallelIndex: 2 }),
];

const session = (): Session =>
  buildStorySession({
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    goal: 'refactor ledger-core',
    state: { kind: 'idle', lastActivityAt: NOW },
    activeMountId: MOUNT_B,
  });

const stepAgent = ({
  id,
  ordinal,
  mountId,
}: {
  readonly id: string;
  readonly ordinal: number;
  readonly mountId?: MountId;
}): Agent => ({
  ...buildStoryAgent({ id: brandId<AgentId>({ value: id }), sessionId: SESSION_ID, name: id }),
  workflowRunId: RUN_ID,
  ordinal,
  ...(mountId !== undefined && { mountId }),
});

let useAppStore: StoryStore;

const seed = async () => {
  const db = await import('@goodboy/db');
  storySpies.listProjectsForWorkspace.mockResolvedValue([
    aProject({
      id: PROJECT_ID,
      workspaceId: WORKSPACE_ID,
      name: 'ledger-core',
      rootPath: '/repos/ledger-core',
    }),
  ]);
  vi.mocked(db.listSessionsForWorkspace).mockResolvedValue([session()]);
  vi.mocked(db.listWorktreesForSessions).mockResolvedValue(new Map([[SESSION_ID, ROWS]]));
  await useAppStore.getState().setCurrentWorkspace(WORKSPACE_ID);
  await vi.waitFor(() => {
    expect(useAppStore.getState().sessionProjectMounts[SESSION_ID]).toHaveLength(2);
  });
};

const placeAgents = ({ agents }: { readonly agents: ReadonlyArray<Agent> }) => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: agents },
    selectedAgentId: { [SESSION_ID]: agents.at(-1)!.id },
    ...connectedAnthropicState(),
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  resetStorySpies();
  useAppStore.setState({ sessionMounts: {} });
  stubStoryInvoke({ gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 } });
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
});

describe('story: a run step stays on the mount it was pinned to', () => {
  it('launches in the pinned worktree while another mount is active', async () => {
    await seed();
    const step = stepAgent({ id: 'agent-step-33', ordinal: 33, mountId: MOUNT_A });
    placeAgents({ agents: [step] });

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: step.id, content: 'go', origin: 'workflow' });

    expect(useAppStore.getState().sessionActiveMount[SESSION_ID]).toBe(MOUNT_B);
    expect(storySpies.runTurn).toHaveBeenCalledWith(
      expect.objectContaining({ workingDir: pathOf({ mountId: MOUNT_A }), mountId: MOUNT_A }),
    );
  });

  it('lets an unpinned step follow the pinned step before it, not the active mount', async () => {
    await seed();
    const first = stepAgent({ id: 'agent-step-1', ordinal: 1, mountId: MOUNT_B });
    const second = stepAgent({ id: 'agent-step-2', ordinal: 2 });
    placeAgents({ agents: [first, second] });
    useAppStore.setState((state) => ({
      sessionActiveMount: { ...state.sessionActiveMount, [SESSION_ID]: MOUNT_A },
    }));

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: second.id, content: 'go', origin: 'workflow' });

    expect(storySpies.runTurn).toHaveBeenCalledWith(
      expect.objectContaining({ workingDir: pathOf({ mountId: MOUNT_B }), mountId: MOUNT_B }),
    );
  });

  it('keeps an explicit mount over the pin so the user can pick another branch', async () => {
    await seed();
    const step = stepAgent({ id: 'agent-step-33', ordinal: 33, mountId: MOUNT_A });
    placeAgents({ agents: [step] });

    await useAppStore.getState().sendTurn({
      sessionId: SESSION_ID,
      agentId: step.id,
      mountId: MOUNT_B,
      content: 'go',
      origin: 'workflow',
    });

    expect(storySpies.runTurn).toHaveBeenCalledWith(
      expect.objectContaining({ workingDir: pathOf({ mountId: MOUNT_B }), mountId: MOUNT_B }),
    );
  });

  it('continues on the mount the agent requested, not the one the step is pinned to', async () => {
    await seed();
    const step = stepAgent({ id: 'agent-step-33', ordinal: 33, mountId: MOUNT_A });
    placeAgents({ agents: [step] });
    queueMountContinuation({
      continuation: {
        operationId: 'op-fork-fix',
        sessionId: SESSION_ID,
        mountId: MOUNT_B,
        mountName: 'ledger-core',
        branch: 'ak/fix-notify-relay',
        worktreePath: pathOf({ mountId: MOUNT_B }),
        origin: 'fork',
      },
    });

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: step.id, content: 'go', origin: 'workflow' });

    await vi.waitFor(() => {
      expect(storySpies.runTurn).toHaveBeenCalledTimes(2);
    });
    expect(storySpies.runTurn).toHaveBeenLastCalledWith(
      expect.objectContaining({ workingDir: pathOf({ mountId: MOUNT_B }), mountId: MOUNT_B }),
    );
  });

  it('refuses to start elsewhere when the pinned mount is gone and names its branch', async () => {
    await seed();
    const step = stepAgent({ id: 'agent-step-33', ordinal: 33, mountId: MOUNT_A });
    placeAgents({ agents: [step] });
    const view = ({ worktree }: { readonly worktree: SessionWorktree }): SessionMountView => ({
      id: brandId<MountId>({ value: worktree.id }),
      sessionId: SESSION_ID,
      projectId: PROJECT_ID,
      worktreePath: worktree.worktreePath,
      lastWorktreePath: null,
      branch: worktree.branch,
      baseBranch: null,
      parallelIndex: worktree.parallelIndex,
      mountName: 'ledger-core',
      repoSlug: null,
      isAttached: true,
      diskState: worktree.id === MOUNT_A ? 'removed' : 'present',
      revision: 3,
      createdAt: NOW,
      updatedAt: NOW,
      repoRoot: '/repos/ledger-core',
    });
    useAppStore.setState({
      sessionMounts: { [SESSION_ID]: ROWS.map((worktree) => view({ worktree })) },
    });
    storySpies.invokeAgentUpdateStatus.mockResolvedValue({ ...step, status: 'blocked' });

    await expect(
      useAppStore
        .getState()
        .sendTurn({ sessionId: SESSION_ID, agentId: step.id, content: 'go', origin: 'workflow' }),
    ).rejects.toThrow(/ak\/refactor-ledger/);

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(storySpies.invokeAgentUpdateStatus).toHaveBeenCalledWith(step.id, {
      status: 'blocked',
    });
    expect(
      useAppStore.getState().sessionPhaseRuns[SESSION_ID]?.find((agent) => agent.id === step.id)
        ?.status,
    ).toBe('blocked');
  });
});

describe('story: a run whose pinned mount was forgotten', () => {
  it('blocks the next step instead of falling back to the active mount', async () => {
    await seed();
    const first = stepAgent({ id: 'agent-step-1', ordinal: 1 });
    const second = stepAgent({ id: 'agent-step-2', ordinal: 2 });
    placeAgents({ agents: [first, second] });
    useAppStore.setState({
      transcripts: {
        [first.id]: [
          {
            kind: 'user_text',
            runId: brandId<ProviderRunId>({ value: 'run-earlier' }),
            text: 'go',
            provider: 'anthropic',
            model: 'claude-sonnet-5-5',
            at: NOW,
          },
        ],
      },
    });
    storySpies.invokeAgentUpdateStatus.mockResolvedValue({ ...second, status: 'blocked' });

    await expect(
      useAppStore
        .getState()
        .sendTurn({ sessionId: SESSION_ID, agentId: second.id, content: 'go', origin: 'workflow' }),
    ).rejects.toThrow(/the branch the run started on/);

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(storySpies.invokeAgentUpdateStatus).toHaveBeenCalledWith(second.id, {
      status: 'blocked',
    });
  });

  it('lets the first step of a fresh run launch on the active mount', async () => {
    await seed();
    const first = stepAgent({ id: 'agent-step-1', ordinal: 1 });
    placeAgents({ agents: [first] });

    await useAppStore
      .getState()
      .sendTurn({ sessionId: SESSION_ID, agentId: first.id, content: 'go', origin: 'workflow' });

    expect(storySpies.runTurn).toHaveBeenCalledWith(
      expect.objectContaining({ workingDir: pathOf({ mountId: MOUNT_B }) }),
    );
  });
});

describe('story: a new run step picks its mount', () => {
  const pick = ({
    agents,
    namedMountId,
  }: {
    readonly agents: ReadonlyArray<Agent>;
    readonly namedMountId?: string;
  }) => {
    useAppStore.setState({ sessionPhaseRuns: { [SESSION_ID]: agents } });
    return selectRunStepMountId({
      state: useAppStore.getState(),
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      namedMountId,
    });
  };

  it('follows the previous step of the run, not the active mount', async () => {
    await seed();

    expect(
      pick({
        agents: [
          stepAgent({ id: 'agent-step-1', ordinal: 1, mountId: MOUNT_A }),
          stepAgent({ id: 'agent-step-2', ordinal: 2, mountId: MOUNT_A }),
        ],
      }),
    ).toBe(MOUNT_A);
  });

  it('names no mount when no earlier step has one, so the launch decides', async () => {
    await seed();

    expect(pick({ agents: [stepAgent({ id: 'agent-step-1', ordinal: 1 })] })).toBeNull();
  });

  it('lets the mount the orchestrator names win', async () => {
    await seed();

    expect(
      pick({
        agents: [stepAgent({ id: 'agent-step-1', ordinal: 1, mountId: MOUNT_A })],
        namedMountId: MOUNT_B,
      }),
    ).toBe(MOUNT_B);
  });

  it('ignores a named mount that is not in the session', async () => {
    await seed();

    expect(
      pick({
        agents: [stepAgent({ id: 'agent-step-1', ordinal: 1, mountId: MOUNT_A })],
        namedMountId: 'mount-unknown',
      }),
    ).toBe(MOUNT_A);
  });
});
