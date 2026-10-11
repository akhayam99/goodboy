import { expect } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  DEFAULT_WORKFLOW_RULES,
  type Agent,
  type AgentId,
  type ArtifactId,
  type Step,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { STORY_NOW } from '../../../store/storyHarness';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { aPlan, aStoredPlan } from '../../../test/planFixtures';
import userEvent from '@testing-library/user-event';
import { type Ctx, type Row, WAIT, click, heading, settle, useAppStore } from './harness';

const WORKFLOW_ID = 'journey-run-page-workflow' as WorkflowId;
const RUN_ID = 'journey-run-page-run' as WorkflowRunId;
const PLAN_AGENT_ID = 'journey-run-page-planner' as AgentId;
const IMPLEMENT_AGENT_ID = 'journey-run-page-implement' as AgentId;
const PLAN_ID = 'journey-run-page-plan' as ArtifactId;

const HELD_MESSAGE = 'The plan is ready. Approve it to start the rest of the run.';

const runPage = ({ sessionId }: Ctx) =>
  sessionPlace({ sessionId, lens: 'workflows', target: { kind: 'run', runId: RUN_ID } });

const stepsOf = (): ReadonlyArray<Step> =>
  ['Plan', 'Implement'].map((name, ordinal) => ({
    id: `${WORKFLOW_ID}-step-${ordinal}` as StepId,
    workflowId: WORKFLOW_ID,
    ordinal,
    name,
    promptPrefix: '',
  }));

const seedHeldRun = ({ sessionId }: Ctx): void => {
  const state = useAppStore.getState();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    throw new Error('the board seed lost its session');
  }
  const workspaceId = session.workspaceId as WorkspaceId;
  const steps = stepsOf();
  const workflow: Workflow = {
    id: WORKFLOW_ID,
    workspaceId,
    name: 'Settle the ledger',
    description: '',
    steps,
    createdAt: STORY_NOW,
    updatedAt: STORY_NOW,
  };
  const run: WorkflowRun = {
    id: RUN_ID,
    workflowId: WORKFLOW_ID,
    ordinal: session.workflowRuns.length,
    currentStep: 1,
    autoRun: false,
    triggerMode: 'immediate',
    executionMode: 'static',
    orchestrationStop: { kind: 'plan-approval', message: HELD_MESSAGE },
    rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' },
  };
  const agents: ReadonlyArray<Agent> = [
    {
      id: PLAN_AGENT_ID,
      sessionId,
      ordinal: 0,
      name: 'Plan',
      workflowRunId: RUN_ID,
      stepId: steps[0]?.id,
      status: 'completed',
    },
    {
      id: IMPLEMENT_AGENT_ID,
      sessionId,
      ordinal: 1,
      name: 'Implement',
      workflowRunId: RUN_ID,
      stepId: steps[1]?.id,
      status: 'pending',
    },
  ];
  const plan = aPlan({
    id: PLAN_ID,
    sessionId,
    agentId: PLAN_AGENT_ID,
    workflowRunId: RUN_ID,
    title: 'Retry-safe webhook credits',
  });
  useAppStore.setState({
    phaseTemplates: { ...state.phaseTemplates, [workspaceId]: [workflow] },
    sessions: state.sessions.map((candidate) =>
      candidate.id === sessionId
        ? { ...candidate, workflowRuns: [...candidate.workflowRuns, run] }
        : candidate,
    ),
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: [...(state.sessionPhaseRuns[sessionId] ?? []), ...agents],
    },
    sessionPlans: { ...state.sessionPlans, [sessionId]: [plan] },
    sessionArtifacts: {
      ...state.sessionArtifacts,
      [sessionId]: [aStoredPlan({ sessionId, agentId: PLAN_AGENT_ID }, plan)],
    },
    activateWorkflowAgent: async ({ sessionId: target, agentId, onStarted }) => {
      useAppStore.setState((current) => ({
        sessionPhaseRuns: {
          ...current.sessionPhaseRuns,
          [target]: (current.sessionPhaseRuns[target] ?? []).map((agent) =>
            agent.id === agentId ? { ...agent, status: 'running' } : agent,
          ),
        },
      }));
      onStarted?.();
    },
  });
};

const runOf = ({ sessionId }: Ctx): WorkflowRun | undefined =>
  useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === sessionId)
    ?.workflowRuns.find((candidate) => candidate.id === RUN_ID);

const statusOf = ({ sessionId }: Ctx, agentId: AgentId): Agent['status'] | undefined =>
  (useAppStore.getState().sessionPhaseRuns[sessionId] ?? []).find((agent) => agent.id === agentId)
    ?.status;

const toastCount = (): number =>
  screen.queryAllByRole('button', { name: 'Dismiss notification' }).length;

const header = () => screen.getByTestId('run-header');

const openRunHeldForItsPlan = async (ctx: Ctx): Promise<void> => {
  seedHeldRun(ctx);
  act(() => useAppStore.getState().navigate({ to: runPage(ctx) }));
  await settle();
};

const reviewThenApproveFromTheDrawer = async (ctx: Ctx): Promise<void> => {
  await openRunHeldForItsPlan(ctx);
  const entry = await within(await screen.findByTestId('run-header', {}, WAIT)).findByRole(
    'button',
    { name: 'Review plan' },
    WAIT,
  );
  fireEvent.click(entry);
  await settle();
  await waitFor(
    () =>
      expect(useAppStore.getState().drawer).toMatchObject({
        kind: 'artifact-document',
        sessionId: ctx.sessionId,
        payload: { artifactId: PLAN_ID },
      }),
    WAIT,
  );
  expect(useAppStore.getState().activeLens[ctx.sessionId] ?? null).toBe('workflows');
  const approve = await screen.findByTestId('plan-primary', {}, WAIT);
  expect(approve.textContent).toBe('Approve');
  await act(async () => {
    fireEvent.click(approve);
  });
  await settle(6);
};

const stepStartedWithOneToast = async (ctx: Ctx): Promise<void> => {
  await waitFor(() => {
    expect(runOf(ctx)?.orchestrationStop).toBeUndefined();
    expect(statusOf(ctx, IMPLEMENT_AGENT_ID)).toBe('running');
  }, WAIT);
  expect(await screen.findByText('Plan approved', {}, WAIT)).toBeDefined();
  expect(screen.getByText('Implement started')).toBeDefined();
  expect(toastCount()).toBe(1);
  expect(screen.queryByRole('button', { name: 'Follow the run' })).toBeNull();
  expect(useAppStore.getState().focusedWorkflowRunId[ctx.sessionId]).toBe(RUN_ID);
  expect(screen.queryByRole('button', { name: 'Review plan' })).toBeNull();
};

const openRunPage = async (ctx: Ctx): Promise<void> => {
  seedHeldRun(ctx);
  act(() => useAppStore.getState().navigate({ to: runPage(ctx) }));
  await settle();
  await screen.findByTestId('run-header', {}, WAIT);
};

const backToTheList = async (ctx: Ctx): Promise<void> => {
  await waitFor(
    () => expect(useAppStore.getState().focusedWorkflowRunId[ctx.sessionId]).toBeNull(),
    WAIT,
  );
  await heading('Runs');
  expect(screen.queryByTestId('run-header')).toBeNull();
};

const pressEscape = async (): Promise<void> => {
  await userEvent.setup().keyboard('{Escape}');
  await settle();
};

const clickRunsCrumb = async (): Promise<void> => {
  const trail = await screen.findByRole('navigation', { name: 'Breadcrumb' }, WAIT);
  await click(within(trail).getByRole('button', { name: /^Runs/ }));
};

export const RUN_PAGE_ROWS: ReadonlyArray<Row> = [
  {
    name: 'a run held for its plan: Review plan opens the drawer, the drawer Approve starts the step with one toast',
    covers: ['navigate', 'openDrawer', 'toast:follow'],
    open: reviewThenApproveFromTheDrawer,
    lands: stepStartedWithOneToast,
  },
  {
    name: 'the run page draws no chevron to the other runs, and Esc goes back to the Runs list',
    covers: ['navigate', 'setFocusedWorkflowRun'],
    open: async (ctx) => {
      await openRunPage(ctx);
      expect(screen.queryByRole('button', { name: 'Show run summary' })).toBeNull();
      expect(within(header()).queryByRole('button', { name: /^Expand / })).toBeNull();
      await pressEscape();
    },
    lands: backToTheList,
  },
  {
    name: 'the Runs crumb goes back to the Runs list',
    covers: ['navigate', 'setFocusedWorkflowRun'],
    open: async (ctx) => {
      await openRunPage(ctx);
      await clickRunsCrumb();
    },
    lands: backToTheList,
  },
];
