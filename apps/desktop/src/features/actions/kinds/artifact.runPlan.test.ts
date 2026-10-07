// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WORKFLOW_RULES,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession, aWorkflowRun, anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../../../store';
import type { RunPlanResult } from '../../../store/slices/plans/types';
import type { ApprovePlanResult } from '../../../store/slices/workflows/types';
import {
  PLAN_FIXTURE_ID,
  PLAN_FIXTURE_PLANNER,
  PLAN_FIXTURE_SESSION,
  aPlan,
  aStoredPlan,
} from '../../../test/planFixtures';
import { resolveActions } from '../resolveActions';
import type { ActionEnv, ArtifactPorts } from '../types';
import { ARTIFACT_KIND } from './artifact';

const showToast = vi.fn();

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast,
  copyText: async () => undefined,
  origin: 'palette',
  anchorKey: null,
  viewing: null,
};

const runFromPalette = async (result: RunPlanResult) => {
  const runPlan = vi.fn(async () => result);
  const plan = aPlan();
  useAppStore.setState({
    runPlan,
    sessionPlans: { [PLAN_FIXTURE_SESSION]: [plan] },
    sessionArtifacts: { [PLAN_FIXTURE_SESSION]: [aStoredPlan({}, plan)] },
    agentTurnState: {},
  });
  const facts = ARTIFACT_KIND.facts({
    state: useAppStore.getState(),
    target: {
      kind: 'artifact',
      sessionId: PLAN_FIXTURE_SESSION,
      subject: { kind: 'stored', artifactId: PLAN_FIXTURE_ID, isPlanRunning: false },
    },
  });
  const definition = ARTIFACT_KIND.actions.find((action) => action.id === 'artifact.runPlan');
  if (facts === null || definition === undefined) {
    throw new Error('the plan facts or the Run plan action are missing');
  }
  await definition.run({ facts, env, choice: null });
  return runPlan;
};

beforeEach(() => {
  showToast.mockClear();
});

describe('Run plan from the palette and the menu', () => {
  it('announces the implementer only when one started', async () => {
    const runPlan = await runFromPalette({
      kind: 'started',
      agentId: 'agent-impl' as AgentId,
      scope: 'workflow',
    });

    expect(runPlan).toHaveBeenCalledWith(PLAN_FIXTURE_SESSION, PLAN_FIXTURE_ID);
    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast.mock.calls[0]?.[0]).toMatchObject({ title: 'Implementer started' });
  });

  it('says why nothing started and offers the run, never "Implementer started"', async () => {
    await runFromPalette({
      kind: 'refused',
      reason: 'The run has no step left for this plan',
      workflowRunId: 'run-settlement' as WorkflowRunId,
    });

    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast.mock.calls[0]?.[0]).toMatchObject({
      title: 'Plan not started',
      message: 'The run has no step left for this plan',
      action: { label: 'Open the run' },
    });
  });

  it('says a plan started outside its workflow when the run was discarded', async () => {
    await runFromPalette({
      kind: 'startedOutside',
      agentId: 'agent-impl' as AgentId,
      note: 'Started outside the run, it was discarded',
    });

    expect(showToast.mock.calls[0]?.[0]).toMatchObject({
      title: 'Implementer started',
      message: 'Started outside the run, it was discarded',
    });
  });

  it('stays quiet when a gate already notified the owner', async () => {
    await runFromPalette({ kind: 'refused', reason: null, workflowRunId: null });

    expect(showToast).not.toHaveBeenCalled();
  });
});

const RUN_ID = 'run-retry' as WorkflowRunId;
const WORKFLOW_ID = 'workflow-retry' as WorkflowId;
const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const AT = '2026-10-05T10:00:00.000Z' as IsoDateTime;

const heldRun = aWorkflowRun({
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
  rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' },
});

const liveRun = aWorkflowRun({ id: RUN_ID, workflowId: WORKFLOW_ID });

const retryWorkflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Retry payments through ledger-core',
  description: '',
  steps: (['planner', 'implementer'] as const).map((role, ordinal) => ({
    id: `step-${ordinal}` as StepId,
    workflowId: WORKFLOW_ID,
    ordinal,
    name: role === 'planner' ? 'Plan' : 'Implement',
    role,
    promptPrefix: '',
  })),
  createdAt: AT,
  updatedAt: AT,
};

type SeedParams = {
  readonly run: WorkflowRun | null;
  readonly isRevising?: boolean;
};

const seed = ({ run, isRevising = false }: SeedParams) => {
  const plan = aPlan({ ...(run !== null && { workflowRunId: run.id }) });
  const planner = anAgent({
    id: PLAN_FIXTURE_PLANNER,
    sessionId: PLAN_FIXTURE_SESSION,
    name: 'Plan',
    ordinal: 0,
    status: 'completed',
    ...(run !== null && { stepId: 'step-0' as StepId, workflowRunId: run.id }),
  });
  const implementer = anAgent({
    id: 'agent-implement' as AgentId,
    sessionId: PLAN_FIXTURE_SESSION,
    name: 'Implement',
    ordinal: 1,
    status: 'pending',
    ...(run !== null && { stepId: 'step-1' as StepId, workflowRunId: run.id }),
  });
  useAppStore.setState({
    sessions: [
      aSession({
        id: PLAN_FIXTURE_SESSION,
        workspaceId: WORKSPACE_ID,
        workflowRuns: run === null ? [] : [run],
      }),
    ],
    phaseTemplates: { [WORKSPACE_ID]: [retryWorkflow] },
    sessionPhaseRuns: { [PLAN_FIXTURE_SESSION]: [planner, implementer] },
    sessionPlans: { [PLAN_FIXTURE_SESSION]: [plan] },
    sessionArtifacts: { [PLAN_FIXTURE_SESSION]: [aStoredPlan({}, plan)] },
    agentTurnState: isRevising
      ? {
          [PLAN_FIXTURE_PLANNER]: {
            kind: 'running',
            runId: 'run-2' as ProviderRunId,
            startedAt: AT,
          },
        }
      : {},
    artifactComments: {},
    currentSessionId: null,
    activeLens: {},
    focusedWorkflowRunId: {},
  });
};

const factsOf = ({ ports }: { readonly ports?: ArtifactPorts } = {}) => {
  const facts = ARTIFACT_KIND.facts({
    state: useAppStore.getState(),
    target: {
      kind: 'artifact',
      sessionId: PLAN_FIXTURE_SESSION,
      subject: { kind: 'stored', artifactId: PLAN_FIXTURE_ID, isPlanRunning: false },
      ...(ports !== undefined && { ports }),
    },
  });
  if (facts === null) {
    throw new Error('the plan facts are missing');
  }
  return facts;
};

const resolved = () =>
  resolveActions({ definitions: ARTIFACT_KIND.actions, facts: factsOf() }).find(
    (action) => action.id === 'artifact.runPlan',
  );

const pressPrimary = async ({ ports }: { readonly ports?: ArtifactPorts } = {}) => {
  const definition = ARTIFACT_KIND.actions.find((action) => action.id === 'artifact.runPlan');
  if (definition === undefined) {
    throw new Error('the primary plan action is missing');
  }
  await definition.run({ facts: factsOf({ ports }), env, choice: null });
};

const stubApprove = (result: ApprovePlanResult) => {
  const approveWorkflowRunPlan = vi.fn(async () => result);
  const reportError = vi.fn(async () => undefined);
  const navigate = vi.fn();
  const runPlan = vi.fn(async (): Promise<RunPlanResult> => ({
    kind: 'started',
    agentId: 'agent-implement' as AgentId,
    scope: 'workflow',
  }));
  useAppStore.setState({ approveWorkflowRunPlan, reportError, navigate, runPlan });
  return { approveWorkflowRunPlan, reportError, navigate, runPlan };
};

describe('the primary plan action follows the one rule', () => {
  it('is Approve for the plan a run is held for and Run plan for a session plan', () => {
    seed({ run: heldRun });
    expect(resolved()?.label).toBe('Approve');

    seed({ run: null });
    expect(resolved()?.label).toBe('Run plan');
  });

  it('is Approve for a run plan whose next step consumes it, held or not', () => {
    seed({ run: liveRun });

    expect(resolved()?.label).toBe('Approve');
  });

  it('says why it waits while the planner revises, and keeps its label', () => {
    seed({ run: heldRun, isRevising: true });

    expect(resolved()).toMatchObject({
      label: 'Approve',
      blockedReason: 'The planner is revising this plan',
    });
  });

  it('is gone once the plan is approved and the run has taken it', () => {
    seed({
      run: aWorkflowRun({
        id: RUN_ID,
        workflowId: WORKFLOW_ID,
        rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan', planApproved: true },
      }),
    });

    expect(resolved()).toBeUndefined();
  });
});

describe('Approve from the palette, the menu and the Artifacts page', () => {
  it('approves the holding run and says the run goes on, with a way to follow it', async () => {
    seed({ run: heldRun });
    const { approveWorkflowRunPlan, runPlan } = stubApprove({
      kind: 'approved',
      next: 'continues',
      agentId: null,
    });

    await pressPrimary();

    expect(approveWorkflowRunPlan).toHaveBeenCalledWith(PLAN_FIXTURE_SESSION, RUN_ID);
    expect(runPlan).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast.mock.calls[0]?.[0]).toMatchObject({
      kind: 'info',
      title: 'Plan approved',
      message: 'The run goes on',
      dedupeKey: `follow:${RUN_ID}`,
      action: { label: 'Follow the run' },
    });
  });

  it('names the step that started', async () => {
    seed({ run: heldRun });
    stubApprove({ kind: 'approved', next: 'started', agentId: 'agent-implement' as AgentId });

    await pressPrimary();

    expect(showToast.mock.calls[0]?.[0]).toMatchObject({
      title: 'Plan approved',
      message: 'Implement started',
    });
  });

  it('takes the user to the run from Follow the run', async () => {
    seed({ run: heldRun });
    const { navigate } = stubApprove({ kind: 'approved', next: 'continues', agentId: null });
    await pressPrimary();

    showToast.mock.calls[0]?.[0].action.onClick();

    expect(navigate).toHaveBeenCalledWith({
      to: {
        at: 'session',
        sessionId: PLAN_FIXTURE_SESSION,
        view: {
          lens: 'workflows',
          agentId: null,
          studio: null,
          target: { kind: 'run', runId: RUN_ID },
        },
      },
    });
  });

  it('leaves out the action when the run page is where the user is', async () => {
    seed({ run: heldRun });
    useAppStore.setState({
      currentSessionId: PLAN_FIXTURE_SESSION,
      activeLens: { [PLAN_FIXTURE_SESSION]: 'workflows' },
      focusedWorkflowRunId: { [PLAN_FIXTURE_SESSION]: RUN_ID },
    });
    stubApprove({ kind: 'approved', next: 'continues', agentId: null });

    await pressPrimary();

    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast.mock.calls[0]?.[0].action).toBeUndefined();
  });

  it('stays quiet on a noop', async () => {
    seed({ run: heldRun });
    const { reportError } = stubApprove({ kind: 'noop', reason: 'not-held' });

    await pressPrimary();

    expect(showToast).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reports a failure instead of toasting success', async () => {
    seed({ run: heldRun });
    const { reportError } = stubApprove({ kind: 'failed', message: 'disk full' });

    await pressPrimary();

    expect(showToast).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith({
      title: "Couldn't approve the plan",
      error: new Error('disk full'),
      sessionId: PLAN_FIXTURE_SESSION,
    });
  });

  it('approves even when the page hands it a Run plan port', async () => {
    seed({ run: heldRun });
    const { approveWorkflowRunPlan } = stubApprove({
      kind: 'approved',
      next: 'continues',
      agentId: null,
    });
    const port = vi.fn(async () => undefined);

    await pressPrimary({ ports: { runPlan: { run: port } } });

    expect(approveWorkflowRunPlan).toHaveBeenCalledOnce();
    expect(port).not.toHaveBeenCalled();
  });

  it('runs the plan through its workflow when the run is not held, and still says approved', async () => {
    seed({ run: liveRun });
    const { approveWorkflowRunPlan, runPlan } = stubApprove({
      kind: 'noop',
      reason: 'not-held',
    });

    await pressPrimary();

    expect(approveWorkflowRunPlan).not.toHaveBeenCalled();
    expect(runPlan).toHaveBeenCalledWith(PLAN_FIXTURE_SESSION, PLAN_FIXTURE_ID);
    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast.mock.calls[0]?.[0]).toMatchObject({
      title: 'Plan approved',
      message: 'Implement started',
      action: { label: 'Follow the run' },
    });
  });

  it('keeps the Run plan path for a session plan', async () => {
    seed({ run: null });
    const { approveWorkflowRunPlan, runPlan } = stubApprove({
      kind: 'noop',
      reason: 'not-held',
    });

    await pressPrimary();

    expect(approveWorkflowRunPlan).not.toHaveBeenCalled();
    expect(runPlan).toHaveBeenCalledOnce();
    expect(showToast.mock.calls[0]?.[0]).toMatchObject({ title: 'Implementer started' });
  });
});
