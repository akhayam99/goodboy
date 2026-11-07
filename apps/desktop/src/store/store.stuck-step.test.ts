import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type StepId,
  type Workflow,
  type WorkflowRun,
} from '@goodboy/types';
import { TEST_NOW, aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryAgent,
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  resetStorySpies,
  storySpies,
  type StoryStore,
} from './storyHarness';

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
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const SILENT_REASON = 'The agent stopped without finishing and without saying why.';

const SCOUT = brandId<AgentId>({ value: 'agent-scout-harborline' });
const BUILD = brandId<AgentId>({ value: 'agent-build-harborline' });
const CHECK = brandId<AgentId>({ value: 'agent-check-harborline' });

const STEP_SCOUT = brandId<StepId>({ value: 'step-scout' });
const STEP_BUILD = brandId<StepId>({ value: 'step-build' });
const STEP_CHECK = brandId<StepId>({ value: 'step-check' });

let useAppStore: StoryStore;
let rows: ReadonlyArray<Agent>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type SeedParams = {
  readonly run?: Partial<WorkflowRun>;
  readonly agents: ReadonlyArray<Partial<Agent> & { readonly id: AgentId }>;
};

const stepOf = ({ id }: { readonly id: AgentId }): StepId =>
  id === SCOUT ? STEP_SCOUT : id === BUILD ? STEP_BUILD : STEP_CHECK;

const seed = ({ run: runPatch = {}, agents }: SeedParams) => {
  const run = aWorkflowRun({ autoRun: true, ...runPatch });
  const session = aSession({ workflowRuns: [run] });
  const workflow: Workflow = {
    id: run.workflowId,
    workspaceId: session.workspaceId,
    name: 'Scout, Build, Check',
    description: '',
    goal: 'retry failed webhook deliveries in notify-relay',
    createdAt: TEST_NOW,
    updatedAt: TEST_NOW,
    steps: [STEP_SCOUT, STEP_BUILD, STEP_CHECK].map((id, ordinal) => ({
      id,
      workflowId: run.workflowId,
      ordinal,
      name: id,
      promptPrefix: '',
    })),
  };
  rows = agents.map((patch, ordinal) =>
    buildStoryAgent({
      sessionId: session.id,
      workflowRunId: run.id,
      stepId: stepOf({ id: patch.id }),
      name: `Step ${ordinal + 1}`,
      ordinal,
      status: 'pending',
      ...patch,
    }),
  );
  const activateWorkflowAgent = vi.fn(async () => undefined);
  const orchestrateNextStep = vi.fn(async () => undefined);
  const sendTurn = vi.fn(async () => ({ blockedOverBudget: false }));
  storySpies.invokeAgentList.mockImplementation(async () => rows);
  storySpies.invokeAgentUpdateStatus.mockImplementation(async (id, fields) => {
    rows = rows.map((row) =>
      row.id === id
        ? {
            ...row,
            status: fields.status,
            ...(fields.outputSummary !== undefined && { outputSummary: fields.outputSummary }),
          }
        : row,
    );
    return rows.find((row) => row.id === id) ?? rows[0]!;
  });
  useAppStore.setState({
    sessions: [session],
    projects: [],
    workflowContinueAttempts: {},
    phaseTemplates: { [session.workspaceId]: [workflow] },
    sessionPhaseRuns: { [session.id]: rows },
    selectedAgentId: { [session.id]: SCOUT },
    agentTurnState: {},
    transcripts: {},
    notifications: [],
    workspaces: [buildStoryWorkspace({ id: session.workspaceId, name: 'harborline', slug: 'hb' })],
    activateWorkflowAgent,
    orchestrateNextStep,
    sendTurn,
    ...connectedAnthropicState(),
  });
  return { session, run, activateWorkflowAgent, orchestrateNextStep, sendTurn };
};

const statusOf = ({ id }: { readonly id: AgentId }): string | undefined =>
  rows.find((row) => row.id === id)?.status;

const summaryOf = ({ id }: { readonly id: AgentId }): string | undefined =>
  rows.find((row) => row.id === id)?.outputSummary;

type FinalizeParams = {
  readonly session: { readonly id: Agent['sessionId'] };
  readonly id: AgentId;
  readonly text: string;
  readonly isDead?: boolean;
};

const finalize = async ({ session, id, text, isDead = false }: FinalizeParams) => {
  const current = useAppStore.getState();
  useAppStore.setState({
    sessionPhaseRuns: { ...current.sessionPhaseRuns, [session.id]: rows },
  });
  return useAppStore
    .getState()
    .finalizeWorkflowStep(session.id, id, text, false, { didAgentDie: isDead });
};

const noticeText = (): string =>
  JSON.stringify(useAppStore.getState().notifications.map((notice) => [notice.title, notice.body]));

beforeEach(() => {
  resetStorySpies();
});

describe('a stuck step in a run that goes on alone', () => {
  it('skips a step that says it is stuck, saves the reason and starts the next step', async () => {
    const { session, run, activateWorkflowAgent } = seed({
      agents: [{ id: SCOUT, status: 'running' }, { id: BUILD }, { id: CHECK }],
    });

    await finalize({
      session,
      id: SCOUT,
      text: '<<step-stuck id="agent-scout-harborline" reason="the notify-relay token is missing">>',
    });

    expect(statusOf({ id: SCOUT })).toBe('skipped');
    expect(summaryOf({ id: SCOUT })).toBe('the notify-relay token is missing');
    expect(activateWorkflowAgent).toHaveBeenCalledWith({
      sessionId: session.id,
      agentId: BUILD,
      focus: 'agent',
      bypassGate: true,
    });
    expect(run.autoRun).toBe(true);
    expect(noticeText()).not.toContain('notify-relay token');
  });

  it('skips a step that stops twice with no marker and stores a plain reason', async () => {
    const { session, activateWorkflowAgent, sendTurn } = seed({
      agents: [{ id: SCOUT, status: 'running' }, { id: BUILD }, { id: CHECK }],
    });

    await finalize({ session, id: SCOUT, text: 'looked around, still reading' });
    expect(statusOf({ id: SCOUT })).toBe('running');
    expect(sendTurn).toHaveBeenCalledTimes(1);
    await finalize({ session, id: SCOUT, text: 'still reading' });

    expect(statusOf({ id: SCOUT })).toBe('skipped');
    expect(summaryOf({ id: SCOUT })).toBe(SILENT_REASON);
    expect(activateWorkflowAgent).toHaveBeenCalledTimes(1);
  });

  it('asks the orchestrator for the next step when the run is orchestrated', async () => {
    const { session, orchestrateNextStep, activateWorkflowAgent } = seed({
      run: { executionMode: 'dynamic' },
      agents: [{ id: SCOUT, status: 'running' }],
    });

    await finalize({
      session,
      id: SCOUT,
      text: '<<step-stuck id="agent-scout-harborline" reason="no repo">>',
    });

    expect(statusOf({ id: SCOUT })).toBe('skipped');
    expect(activateWorkflowAgent).not.toHaveBeenCalled();
    expect(orchestrateNextStep).toHaveBeenCalledWith(session.id, expect.anything(), {
      bypassGate: true,
    });
  });

  it('starts nothing while the run is paused', async () => {
    const { session, activateWorkflowAgent } = seed({
      run: { orchestrationStop: { kind: 'paused', message: 'Paused by you' } },
      agents: [{ id: SCOUT, status: 'running' }, { id: BUILD }],
    });

    await finalize({
      session,
      id: SCOUT,
      text: '<<step-stuck id="agent-scout-harborline" reason="no repo">>',
    });

    expect(statusOf({ id: SCOUT })).toBe('skipped');
    expect(activateWorkflowAgent).not.toHaveBeenCalled();
  });

  it('keeps a dead agent failed, never stuck', async () => {
    const { session, activateWorkflowAgent } = seed({
      agents: [{ id: SCOUT, status: 'running' }, { id: BUILD }],
    });

    await finalize({ session, id: SCOUT, text: '', isDead: true });
    await finalize({ session, id: SCOUT, text: '', isDead: true });

    expect(statusOf({ id: SCOUT })).toBe('failed');
    expect(activateWorkflowAgent).not.toHaveBeenCalled();
  });

  it('stops the run on a second stuck step in a row', async () => {
    const { session, activateWorkflowAgent } = seed({
      agents: [
        { id: SCOUT, status: 'skipped', outputSummary: 'the plan tool was missing' },
        { id: BUILD, status: 'running' },
        { id: CHECK },
      ],
    });

    await finalize({
      session,
      id: BUILD,
      text: '<<step-stuck id="agent-build-harborline" reason="no repo">>',
    });

    expect(statusOf({ id: BUILD })).toBe('blocked');
    expect(activateWorkflowAgent).not.toHaveBeenCalled();
  });

  it('does not count a step the user skipped as a stuck one', async () => {
    const { session, activateWorkflowAgent } = seed({
      agents: [{ id: SCOUT, status: 'skipped' }, { id: BUILD, status: 'running' }, { id: CHECK }],
    });

    await finalize({
      session,
      id: BUILD,
      text: '<<step-stuck id="agent-build-harborline" reason="no repo">>',
    });

    expect(statusOf({ id: BUILD })).toBe('skipped');
    expect(activateWorkflowAgent).toHaveBeenCalledWith(expect.objectContaining({ agentId: CHECK }));
  });

  it('tells the next step what is missing in its kickoff', async () => {
    const { session } = seed({
      agents: [
        { id: SCOUT, status: 'skipped', outputSummary: 'the notify-relay token is missing' },
        { id: BUILD },
      ],
    });
    const { composeMissingStepsSection } =
      await import('./slices/workflows/stuckStep/composeMissingStepsSection');

    const section = composeMissingStepsSection({
      runs: rows,
      workflowRunId: rows[1]?.workflowRunId,
    });

    expect(section).toContain('Step 1: the notify-relay token is missing');
    expect(session.id).toBe(rows[0]?.sessionId);
  });
});

describe('a stuck step in a run that asks every step', () => {
  it('blocks the step and waits for the two buttons', async () => {
    const { session, activateWorkflowAgent } = seed({
      run: { autoRun: false },
      agents: [{ id: SCOUT, status: 'running' }, { id: BUILD }],
    });

    await finalize({
      session,
      id: SCOUT,
      text: '<<step-stuck id="agent-scout-harborline" reason="no repo">>',
    });

    expect(statusOf({ id: SCOUT })).toBe('blocked');
    expect(summaryOf({ id: SCOUT })).toBeUndefined();
    expect(activateWorkflowAgent).not.toHaveBeenCalled();
  });

  it('goes on after Skip step, and a second window pressing it changes nothing', async () => {
    const { session, run, activateWorkflowAgent } = seed({
      run: { autoRun: true },
      agents: [{ id: SCOUT, status: 'blocked' }, { id: BUILD }],
    });

    await useAppStore.getState().skipStuckStepAndAdvance(session.id, run.id, { agentId: SCOUT });
    await useAppStore.getState().skipStuckStepAndAdvance(session.id, run.id, { agentId: SCOUT });

    expect(statusOf({ id: SCOUT })).toBe('skipped');
    expect(summaryOf({ id: SCOUT })).toBeUndefined();
    expect(activateWorkflowAgent).toHaveBeenCalledTimes(1);
    const skips = storySpies.invokeAgentUpdateStatus.mock.calls.filter(
      ([, fields]) => fields.status === 'skipped',
    );
    expect(skips).toHaveLength(1);
  });

  it('starts the next step from Skip step when the run asks every step', async () => {
    const { session, run, activateWorkflowAgent } = seed({
      run: { autoRun: false },
      agents: [{ id: SCOUT, status: 'blocked' }, { id: BUILD }],
    });

    await useAppStore
      .getState()
      .skipStuckStepAndAdvance(session.id, run.id, { agentId: SCOUT, shouldGoOn: true });

    expect(statusOf({ id: SCOUT })).toBe('skipped');
    expect(activateWorkflowAgent).toHaveBeenCalledTimes(1);
  });

  it('skips and stays put from the menu when the run asks every step', async () => {
    const { session, run, activateWorkflowAgent } = seed({
      run: { autoRun: false },
      agents: [{ id: SCOUT, status: 'blocked' }, { id: BUILD }],
    });

    await useAppStore.getState().skipStuckStepAndAdvance(session.id, run.id, { agentId: SCOUT });

    expect(statusOf({ id: SCOUT })).toBe('skipped');
    expect(activateWorkflowAgent).not.toHaveBeenCalled();
  });
});

describe('a late result and a question', () => {
  it('drops a late result for a step that was already skipped', async () => {
    const { session, activateWorkflowAgent } = seed({
      agents: [{ id: SCOUT, status: 'skipped', outputSummary: 'no repo' }, { id: BUILD }],
    });

    const result = await finalize({
      session,
      id: SCOUT,
      text: 'all done <<step-done id="agent-scout-harborline">>',
    });

    expect(result).toEqual({ shouldAutoAdvance: false });
    expect(statusOf({ id: SCOUT })).toBe('skipped');
    expect(activateWorkflowAgent).not.toHaveBeenCalled();
  });

  it('holds on a real question before it counts the step as stuck', async () => {
    const { session, activateWorkflowAgent } = seed({
      agents: [{ id: SCOUT, status: 'running' }, { id: BUILD }],
    });

    await finalize({
      session,
      id: SCOUT,
      text: 'Need an answer.\n<<ctx-question blocking="true">>Which Northwind sandbox do I use?<</ctx-question>>',
    });

    expect(statusOf({ id: SCOUT })).not.toBe('skipped');
    expect(activateWorkflowAgent).not.toHaveBeenCalled();
  });
});

describe('Keep working on a not finished step', () => {
  it('sends the same agent a turn that ends with the step markers', async () => {
    const { session, sendTurn } = seed({
      agents: [{ id: SCOUT, status: 'skipped', outputSummary: 'no repo' }, { id: BUILD }],
    });

    await useAppStore.getState().keepWorkingOnStep({ sessionId: session.id, agentId: SCOUT });

    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: session.id,
        agentId: SCOUT,
        origin: 'workflow',
        content: expect.stringContaining('<<step-done id="agent-scout-harborline">>'),
      }),
    );
  });

  it('refuses a step the user skipped', async () => {
    const { session } = seed({ agents: [{ id: SCOUT, status: 'skipped' }, { id: BUILD }] });

    await expect(
      useAppStore.getState().keepWorkingOnStep({ sessionId: session.id, agentId: SCOUT }),
    ).rejects.toThrow('This step is not waiting to be finished.');
  });
});
