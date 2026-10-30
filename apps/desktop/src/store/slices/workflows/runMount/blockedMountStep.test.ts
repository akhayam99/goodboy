// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type Agent,
  type MountId,
  type ProjectId,
  type SessionMountView,
  type Step,
  type StepId,
  type Workflow,
} from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryAgent,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../storyHarness';
import {
  FIXTURE_NOW,
  RUN,
  SESSION,
  STEP_BUILD,
  STEP_PLAN,
  WORKFLOW,
  WORKSPACE,
  runFixture,
  sessionFixture,
} from '../../../../__tests__/helpers/actionFixtures';
import { selectMountBlockedStep } from './selectMountBlockedStep';

const { decideSpy, updateHintsSpy } = vi.hoisted(() => ({
  decideSpy: vi.fn(),
  updateHintsSpy: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../storyHarness')).dbModuleMock({
    updateWorkflowRunOrchestratorHints: updateHintsSpy,
    updateWorkflowRunOrchestrationStop: vi.fn(async () => undefined),
    updateWorkflowRunOrchestrationOutcome: vi.fn(async () => undefined),
  }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../../features/onboarding/onboardingSettings', async () =>
  (await import('../../../storyHarness')).onboardingStoreModuleMock(),
);
vi.mock('../../../../features/chat/turn', async () =>
  (await import('../../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../../features/permissions/permissions', async () =>
  (await import('../../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../../features/providers/providers', async () =>
  (await import('../../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../../features/providers/routing', async () =>
  (await import('../../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../../features/budget/budget', async () =>
  (await import('../../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../../features/skills/skills', async () =>
  (await import('../../../storyHarness')).skillsModuleMock(),
);
vi.mock('../../../../features/workflows/workflows', async () =>
  (await import('../../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../../features/worktree/worktree', async () =>
  (await import('../../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../shared/lib/repo', async () =>
  (await import('../../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../../shared/lib/editor', async () =>
  (await import('../../../storyHarness')).editorModuleMock(),
);
vi.mock('../../../../features/plans/plans', async () =>
  (await import('../../../storyHarness')).plansModuleMock(),
);
vi.mock('../../../../features/integrations/linear/client', async () =>
  (await import('../../../storyHarness')).linearClientModuleMock(),
);
vi.mock('../../../../features/integrations/github/github', async () =>
  (await import('../../../storyHarness')).githubModuleMock(),
);
vi.mock('@goodboy/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@goodboy/core')>();
  return {
    ...original,
    OrchestratorClient: vi.fn(function () {
      return { decide: decideSpy };
    }),
  };
});

const PROJECT_ID = brandId<ProjectId>({ value: 'project-ledger-core' });
const MOUNT_A = brandId<MountId>({ value: 'mount-refactor' });
const MOUNT_B = brandId<MountId>({ value: 'mount-fix' });
const BRANCH_A = 'ak/refactor-ledger';
const BRANCH_B = 'ak/fix-notify-relay';
const REPLAN = 'step-replan';

const pathOf = ({ mountId }: { readonly mountId: MountId }): string =>
  `/repos/ledger-core/.goodboy/worktrees/${mountId}`;

const NO_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
  estimatedCostUsd: 0,
};

type ViewParams = {
  readonly id: MountId;
  readonly branch: string;
  readonly isAttached: boolean;
};

const viewOf = ({ id, branch, isAttached }: ViewParams): SessionMountView => ({
  id,
  sessionId: SESSION,
  projectId: PROJECT_ID,
  worktreePath: isAttached ? pathOf({ mountId: id }) : null,
  lastWorktreePath: pathOf({ mountId: id }),
  branch,
  baseBranch: null,
  parallelIndex: id === MOUNT_A ? 1 : 2,
  mountName: 'ledger-core',
  repoSlug: null,
  isAttached,
  diskState: 'present',
  revision: 3,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  repoRoot: '/repos/ledger-core',
});

const toMount = (view: SessionMountView) => ({
  mountId: view.id,
  sessionId: SESSION,
  projectId: PROJECT_ID,
  mountName: view.mountName,
  worktreePath: pathOf({ mountId: view.id }),
  lastWorktreePath: view.lastWorktreePath,
  repoRoot: view.repoRoot,
  branch: view.branch,
  baseBranch: view.baseBranch,
  parallelIndex: view.parallelIndex,
  isAttached: true as const,
  diskState: view.diskState,
  revision: view.revision,
});

const stepOf = ({ id, ordinal, name }: { id: StepId; ordinal: number; name: string }): Step => ({
  id,
  workflowId: WORKFLOW,
  ordinal,
  name,
  role: 'implementer',
  promptPrefix: 'Do the work.',
});

const workflowOf = (): Workflow => ({
  id: WORKFLOW,
  workspaceId: WORKSPACE,
  name: 'Ledger export',
  description: '',
  origin: 'orchestrated',
  steps: [
    stepOf({ id: STEP_PLAN, ordinal: 0, name: 'Plan' }),
    stepOf({ id: STEP_BUILD, ordinal: 1, name: 'Build' }),
  ],
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
});

const doneAgent = ({
  id,
  ordinal,
  stepId,
}: {
  readonly id: string;
  readonly ordinal: number;
  readonly stepId: StepId;
}): Agent => ({
  ...buildStoryAgent({
    id: brandId<Agent['id']>({ value: id }),
    sessionId: SESSION,
    name: id,
  }),
  stepId,
  workflowRunId: RUN,
  ordinal,
  status: 'completed',
  mountId: MOUNT_A,
  startedAt: FIXTURE_NOW,
  completedAt: FIXTURE_NOW,
});

let useAppStore: StoryStore;

const seed = ({ isDetached }: { readonly isDetached: boolean }): void => {
  const views = [
    viewOf({ id: MOUNT_A, branch: BRANCH_A, isAttached: !isDetached }),
    viewOf({ id: MOUNT_B, branch: BRANCH_B, isAttached: true }),
  ];
  useAppStore.setState({
    ...connectedAnthropicState(),
    currentWorkspaceId: WORKSPACE,
    sessions: [
      sessionFixture({
        activeMountId: MOUNT_B,
        workflowRuns: [runFixture({ executionMode: 'dynamic', autoRun: true })],
      }),
    ],
    projects: [aProject({ id: PROJECT_ID, workspaceId: WORKSPACE, name: 'ledger-core' })],
    phaseTemplates: { [WORKSPACE]: [workflowOf()] },
    sessionWorkflows: { [SESSION]: [workflowOf()] },
    sessionPhaseRuns: {
      [SESSION]: [
        doneAgent({ id: 'agent-plan', ordinal: 9, stepId: STEP_PLAN }),
        doneAgent({ id: 'agent-build', ordinal: 10, stepId: STEP_BUILD }),
      ],
    },
    sessionMounts: { [SESSION]: views },
    sessionProjectMounts: {
      [SESSION]: views.filter((view) => view.isAttached).map(toMount),
    },
    sessionWorktrees: {
      [SESSION]: views
        .filter((view) => view.isAttached)
        .map((view) => pathOf({ mountId: view.id })),
    },
    sessionActiveMount: { [SESSION]: MOUNT_B },
    selectedAgentId: { [SESSION]: null },
    orchestratorReadingHints: {},
  });
};

const agents = (): ReadonlyArray<Agent> => useAppStore.getState().sessionPhaseRuns[SESSION] ?? [];

const blockOf = () =>
  selectMountBlockedStep({
    state: useAppStore.getState(),
    sessionId: SESSION,
    workflowRunId: RUN,
    activeMountId: MOUNT_B,
  });

const stubAgentRows = (): void => {
  let counter = 10;
  storySpies.invokeAgentInsert.mockImplementation(async (input: Partial<Agent>) => {
    counter += 1;
    return {
      ...buildStoryAgent({
        id: brandId<Agent['id']>({ value: `agent-step-${counter}` }),
        sessionId: SESSION,
        name: input.name ?? 'step',
      }),
      ...input,
      id: brandId<Agent['id']>({ value: `agent-step-${counter}` }),
      sessionId: SESSION,
      ordinal: input.ordinal ?? counter,
      name: input.name ?? 'step',
      status: input.status ?? 'pending',
    } satisfies Agent;
  });
  storySpies.invokeAgentUpdateStatus.mockImplementation(
    async (id: Agent['id'], fields: { status: Agent['status']; mountId?: MountId }) => {
      const found = agents().find((agent) => agent.id === id);
      if (found === undefined) {
        throw new Error(`no agent ${id}`);
      }
      return {
        ...found,
        status: fields.status,
        ...(fields.mountId !== undefined && { mountId: fields.mountId }),
      };
    },
  );
  storySpies.invokeAgentList.mockImplementation(async () => agents());
  storySpies.invokeWorkflowUpsert.mockImplementation(async (workflow) => ({
    ...workflowOf(),
    ...workflow,
    steps: workflow.steps.map((step, index) => ({
      ...stepOf({
        id: brandId<StepId>({ value: step.id ?? REPLAN }),
        ordinal: index,
        name: step.name,
      }),
      ...step,
    })),
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
  }));
};

const decideNextStep = (): void => {
  decideSpy.mockResolvedValue({
    decision: {
      action: 'next',
      reason: 'Refunds need the same batching.',
      step: {
        name: 'Cover refunds',
        role: 'implementer',
        promptPrefix: 'Apply the batching to refunds.',
      },
    },
    usage: NO_USAGE,
    model: 'claude-haiku-4-5',
  });
};

const hint = (text: string) =>
  useAppStore.getState().addWorkflowOrchestratorHint(SESSION, RUN, { text, delivery: 'now' });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  vi.clearAllMocks();
  await resetStoryStore();
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  stubAgentRows();
  decideNextStep();
});

describe('story: a run step blocked on a detached mount', () => {
  it('turns the first hint into one blocked step that names its branch and its ways out', async () => {
    seed({ isDetached: true });

    await hint('Cover refunds too.');

    await vi.waitFor(() => {
      expect(agents()).toHaveLength(3);
    });
    const created = agents().at(-1)!;
    expect(created.status).toBe('blocked');
    expect(created.mountId).toBe(MOUNT_A);
    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(blockOf()).toMatchObject({
      agentId: created.id,
      stepNumber: 3,
      branch: BRANCH_A,
      isReattachable: true,
      suggested: { mountId: MOUNT_B, branch: BRANCH_B },
      choices: [{ mountId: MOUNT_B, branch: BRANCH_B }],
    });
  });

  it('queues the next hint instead of making another step on the same pin', async () => {
    seed({ isDetached: true });
    await hint('Cover refunds too.');
    await vi.waitFor(() => {
      expect(agents()).toHaveLength(3);
    });
    decideSpy.mockClear();

    const second = await hint('And the chargebacks.');

    expect(second).not.toBeNull();
    await vi.waitFor(() => {
      expect(updateHintsSpy).toHaveBeenCalledTimes(3);
    });
    expect(decideSpy).not.toHaveBeenCalled();
    expect(agents()).toHaveLength(3);
    expect(agents().filter((agent) => agent.status === 'blocked')).toHaveLength(1);
    const queued = useAppStore
      .getState()
      .sessions[0]?.workflowRuns[0]?.orchestratorHints?.filter((entry) => entry.consumedAt == null);
    expect(queued?.map((entry) => entry.text)).toEqual(['And the chargebacks.']);
  });

  it('does not let a read of the queue start a decision while the step waits', async () => {
    seed({ isDetached: true });
    await hint('Cover refunds too.');
    await vi.waitFor(() => {
      expect(agents()).toHaveLength(3);
    });
    await hint('And the chargebacks.');
    decideSpy.mockClear();

    await useAppStore.getState().orchestrateNextStep(SESSION, RUN);

    expect(decideSpy).not.toHaveBeenCalled();
    expect(agents()).toHaveLength(3);
  });

  it('starts the blocked step on its own branch when Reattach is pressed', async () => {
    seed({ isDetached: true });
    await hint('Cover refunds too.');
    await vi.waitFor(() => {
      expect(agents()).toHaveLength(3);
    });
    const blocked = blockOf()!;
    const attachMount = vi.fn(async () => {
      const attached = viewOf({ id: MOUNT_A, branch: BRANCH_A, isAttached: true });
      useAppStore.setState((state) => ({
        sessionMounts: {
          ...state.sessionMounts,
          [SESSION]: [attached, ...(state.sessionMounts[SESSION] ?? []).slice(1)],
        },
        sessionProjectMounts: {
          ...state.sessionProjectMounts,
          [SESSION]: [toMount(attached), ...(state.sessionProjectMounts[SESSION] ?? [])],
        },
      }));
      return attached;
    });
    useAppStore.setState({ attachMount });
    const activate = vi.fn(async () => undefined);
    useAppStore.setState({ activateWorkflowAgent: activate });

    await useAppStore.getState().resolveMountBlockedStep({
      sessionId: SESSION,
      agentId: blocked.agentId,
      choice: { kind: 'reattach' },
    });

    expect(attachMount).toHaveBeenCalledWith({ sessionId: SESSION, mountId: MOUNT_A });
    expect(storySpies.invokeAgentUpdateStatus).toHaveBeenLastCalledWith(blocked.agentId, {
      status: 'pending',
      mountId: MOUNT_A,
    });
    expect(activate).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION, agentId: blocked.agentId }),
    );
    expect(blockOf()).toBeNull();
  });

  it.each([
    { label: 'stops', patch: { orchestrationStop: { kind: 'operator', message: 'Stopped.' } } },
    { label: 'closes', patch: { orchestrationStop: { kind: 'closed', message: 'Closed.' } } },
    { label: 'discards', patch: { discardedAt: FIXTURE_NOW } },
  ] as const)(
    'leaves the step blocked when the run $label while Reattach is pending',
    async ({ patch }) => {
      seed({ isDetached: true });
      await hint('Cover refunds too.');
      await vi.waitFor(() => {
        expect(agents()).toHaveLength(3);
      });
      const blocked = blockOf()!;
      const attachMount = vi.fn(async () => {
        const attached = viewOf({ id: MOUNT_A, branch: BRANCH_A, isAttached: true });
        useAppStore.setState((state) => ({
          sessions: state.sessions.map((session) => ({
            ...session,
            workflowRuns: session.workflowRuns.map((run) => ({ ...run, ...patch })),
          })),
          sessionMounts: {
            ...state.sessionMounts,
            [SESSION]: [attached, ...(state.sessionMounts[SESSION] ?? []).slice(1)],
          },
          sessionProjectMounts: {
            ...state.sessionProjectMounts,
            [SESSION]: [toMount(attached), ...(state.sessionProjectMounts[SESSION] ?? [])],
          },
        }));
        return attached;
      });
      const activate = vi.fn(async () => undefined);
      useAppStore.setState({ attachMount, activateWorkflowAgent: activate });
      storySpies.invokeAgentUpdateStatus.mockClear();

      await expect(
        useAppStore.getState().resolveMountBlockedStep({
          sessionId: SESSION,
          agentId: blocked.agentId,
          choice: { kind: 'reattach' },
        }),
      ).rejects.toThrow('run was stopped');

      expect(storySpies.invokeAgentUpdateStatus).not.toHaveBeenCalled();
      expect(activate).not.toHaveBeenCalled();
      expect(agents().find((agent) => agent.id === blocked.agentId)?.status).toBe('blocked');
    },
  );

  it('re-pins the step to the other branch and starts it there', async () => {
    seed({ isDetached: true });
    await hint('Cover refunds too.');
    await vi.waitFor(() => {
      expect(agents()).toHaveLength(3);
    });
    const blocked = blockOf()!;

    await useAppStore.getState().resolveMountBlockedStep({
      sessionId: SESSION,
      agentId: blocked.agentId,
      choice: { kind: 'use', mountId: MOUNT_B },
    });

    expect(storySpies.invokeAgentUpdateStatus).toHaveBeenCalledWith(blocked.agentId, {
      status: 'pending',
      mountId: MOUNT_B,
    });
    await vi.waitFor(() => {
      expect(storySpies.runTurn).toHaveBeenCalledWith(
        expect.objectContaining({ workingDir: pathOf({ mountId: MOUNT_B }), mountId: MOUNT_B }),
      );
    });
    expect(blockOf()).toBeNull();
  });

  it('refuses a choice that is not in the session and leaves the step blocked', async () => {
    seed({ isDetached: true });
    await hint('Cover refunds too.');
    await vi.waitFor(() => {
      expect(agents()).toHaveLength(3);
    });
    const blocked = blockOf()!;
    storySpies.invokeAgentUpdateStatus.mockClear();

    await expect(
      useAppStore.getState().resolveMountBlockedStep({
        sessionId: SESSION,
        agentId: blocked.agentId,
        choice: { kind: 'use', mountId: brandId<MountId>({ value: 'mount-elsewhere' }) },
      }),
    ).rejects.toThrow('not in this session');

    expect(storySpies.invokeAgentUpdateStatus).not.toHaveBeenCalled();
    expect(blockOf()).not.toBeNull();
  });

  it('puts the step back to blocked and says so when the start fails', async () => {
    seed({ isDetached: true });
    await hint('Cover refunds too.');
    await vi.waitFor(() => {
      expect(agents()).toHaveLength(3);
    });
    const blocked = blockOf()!;
    useAppStore.setState({
      activateWorkflowAgent: vi.fn(async () => {
        throw new Error('provider unavailable');
      }),
    });

    await expect(
      useAppStore.getState().resolveMountBlockedStep({
        sessionId: SESSION,
        agentId: blocked.agentId,
        choice: { kind: 'use', mountId: MOUNT_B },
      }),
    ).rejects.toThrow('provider unavailable');

    expect(agents().at(-1)?.status).toBe('blocked');
  });

  it('rejects a late press once the step no longer waits for a branch', async () => {
    seed({ isDetached: false });
    const [first] = agents();

    await expect(
      useAppStore.getState().resolveMountBlockedStep({
        sessionId: SESSION,
        agentId: first!.id,
        choice: { kind: 'reattach' },
      }),
    ).rejects.toThrow('not waiting for a branch');
  });

  it('keeps Restart step on the same block instead of starting a turn', async () => {
    seed({ isDetached: true });
    await hint('Cover refunds too.');
    await vi.waitFor(() => {
      expect(agents()).toHaveLength(3);
    });
    storySpies.runTurn.mockClear();

    await useAppStore.getState().recoverStuckStep({ sessionId: SESSION, workflowRunId: RUN });

    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(agents().at(-1)?.status).toBe('blocked');
    expect(blockOf()?.branch).toBe(BRANCH_A);
  });

  it('lets a run whose pin is attached read hints as before', async () => {
    seed({ isDetached: false });

    await hint('Cover refunds too.');

    await vi.waitFor(() => {
      expect(decideSpy).toHaveBeenCalledTimes(1);
    });
    expect(blockOf()).toBeNull();
  });
});
