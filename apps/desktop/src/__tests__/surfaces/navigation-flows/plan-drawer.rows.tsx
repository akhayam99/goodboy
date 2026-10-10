import { expect } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  ArtifactComment,
  ArtifactId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import { openPlanDrawer } from '../../../features/plans/openPlanDrawer';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { STORY_NOW } from '../../../store/storyHarness';
import { aPlannerQuestion } from '../../../test/planDrawerFixtures';
import { aPlan, aStoredPlan } from '../../../test/planFixtures';
import { type Ctx, type Row, WAIT, settle, useAppStore, visible } from './harness';

const PLAN_ID = 'journey-plan-drawer-plan' as ArtifactId;
const RUN_ID = 'journey-plan-drawer-run' as WorkflowRunId;
const WORKFLOW_ID = 'journey-plan-drawer-workflow' as WorkflowId;
const PLANNER_ID = 'journey-plan-drawer-planner' as AgentId;
const IMPLEMENTER_ID = 'journey-plan-drawer-implementer' as AgentId;
const STEP_PLAN = 'journey-plan-drawer-step-plan' as StepId;
const STEP_IMPLEMENT = 'journey-plan-drawer-step-implement' as StepId;

const GOAL = 'Retried webhooks must never post a second credit.';

const V2_GOAL = 'Retried webhooks must never post a second credit, whatever the retry delay.';

const EDITED_SOURCE = `# Retry-safe webhook credits\n\n## Goal\n${V2_GOAL} Say it in the first line.`;

type Journey = {
  readonly activations: Array<AgentId>;
  readonly saves: Array<number>;
};

let journey: Journey = { activations: [], saves: [] };

const patchPlan = ({ bodyMd, revision }: { readonly bodyMd: string; readonly revision: number }) =>
  useAppStore.setState((state) => ({
    sessionPlans: Object.fromEntries(
      Object.entries(state.sessionPlans).map(([sessionId, plans]) => [
        sessionId,
        plans?.map((plan) => (plan.id === PLAN_ID ? { ...plan, bodyMd } : plan)),
      ]),
    ),
    sessionArtifacts: Object.fromEntries(
      Object.entries(state.sessionArtifacts).map(([sessionId, artifacts]) => [
        sessionId,
        artifacts?.map((artifact) =>
          artifact.id === PLAN_ID ? { ...artifact, sourceText: bodyMd, revision } : artifact,
        ),
      ]),
    ),
  }));

const setComments = ({
  sessionId,
  update,
}: {
  readonly sessionId: Ctx['sessionId'];
  readonly update: (comments: ReadonlyArray<ArtifactComment>) => ReadonlyArray<ArtifactComment>;
}) =>
  useAppStore.setState((state) => ({
    artifactComments: {
      ...state.artifactComments,
      [sessionId]: update(state.artifactComments[sessionId] ?? []),
    },
  }));

const seedHeldRun = ({ sessionId }: Ctx): void => {
  journey = { activations: [], saves: [] };
  const state = useAppStore.getState();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    throw new Error('the board seed lost its session');
  }
  const workspaceId = session.workspaceId as WorkspaceId;
  const workflow: Workflow = {
    id: WORKFLOW_ID,
    workspaceId,
    name: 'Retry payments through ledger-core',
    description: '',
    steps: [
      {
        id: STEP_PLAN,
        workflowId: WORKFLOW_ID,
        ordinal: 0,
        name: 'Plan',
        role: 'planner',
        promptPrefix: '',
      },
      {
        id: STEP_IMPLEMENT,
        workflowId: WORKFLOW_ID,
        ordinal: 1,
        name: 'Implement',
        role: 'implementer',
        promptPrefix: '',
      },
    ],
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
    orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
    rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' },
  };
  const agents: ReadonlyArray<Agent> = [
    {
      id: PLANNER_ID,
      sessionId,
      ordinal: 100,
      name: 'Plan',
      kind: 'planner',
      status: 'completed',
      workflowRunId: RUN_ID,
      stepId: STEP_PLAN,
    },
    {
      id: IMPLEMENTER_ID,
      sessionId,
      ordinal: 101,
      name: 'Implement',
      kind: 'implementer',
      status: 'pending',
      workflowRunId: RUN_ID,
      stepId: STEP_IMPLEMENT,
    },
  ];
  const plan = aPlan({
    id: PLAN_ID,
    sessionId,
    agentId: PLANNER_ID,
    workflowRunId: RUN_ID,
    bodyMd: `## Goal\n${GOAL}`,
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
      [sessionId]: [aStoredPlan({ sessionId, agentId: PLANNER_ID, revision: 1 }, plan)],
    },
    artifactComments: { ...state.artifactComments, [sessionId]: [] },
    loadArtifactComments: async () => undefined,
    addArtifactComment: async ({ artifactId, revision, anchor, body }) => {
      const id = `journey-plan-drawer-comment-${Date.now()}`;
      setComments({
        sessionId,
        update: (comments) => [
          ...comments,
          {
            id,
            sessionId,
            artifactId,
            revision,
            anchor,
            body: body.trim(),
            status: 'draft',
            sentTurnId: null,
            createdAt: STORY_NOW,
            updatedAt: STORY_NOW,
          },
        ],
      });
      return id;
    },
    sendArtifactComments: async () => {
      patchPlan({ bodyMd: `## Goal\n${V2_GOAL}`, revision: 2 });
      setComments({
        sessionId,
        update: (comments) =>
          comments.map((comment) => ({ ...comment, status: 'addressed' as const })),
      });
      return { kind: 'revised' as const, revision: 2, addressed: 1, open: 0 };
    },
    updatePlanBody: async (_sessionId, _planId, _title, bodyMd, expectedRevision) => {
      journey.saves.push(expectedRevision);
      patchPlan({ bodyMd, revision: expectedRevision + 1 });
      return { kind: 'saved' as const, revision: expectedRevision + 1 };
    },
    activateWorkflowAgent: async ({ agentId, onStarted }) => {
      journey.activations.push(agentId);
      useAppStore.setState((current) => ({
        sessionPhaseRuns: {
          ...current.sessionPhaseRuns,
          [sessionId]: (current.sessionPhaseRuns[sessionId] ?? []).map((agent) =>
            agent.id === agentId ? { ...agent, status: 'running' as const } : agent,
          ),
        },
      }));
      window.dispatchEvent(
        new CustomEvent('goodboy:workflow-step-started', {
          detail: { sessionId, agentId, stepName: 'Implement' },
        }),
      );
      onStarted?.();
      return undefined;
    },
  });
};

const click = async (element: HTMLElement): Promise<void> => {
  fireEvent.click(element);
  await settle();
};

const comment = async (): Promise<void> => {
  const body = await screen.findByTestId('plan-drawer-body', undefined, WAIT);
  const paragraph = await waitFor(() => {
    const found = [...body.querySelectorAll('p')].find((node) => node.textContent === GOAL);
    expect(found).toBeDefined();
    return found as HTMLElement;
  }, WAIT);
  fireEvent.mouseOver(paragraph);
  await click(await screen.findByRole('button', { name: 'Comment on this text' }, WAIT));
  fireEvent.change(await screen.findByRole('textbox', { name: 'Comment for the planner' }, WAIT), {
    target: { value: 'Say what the retry delay is.' },
  });
  await click(screen.getByRole('button', { name: 'Add comment' }));
  await waitFor(
    () => expect(screen.getByTestId('plan-comment-bar').textContent).toContain('1 comment'),
    WAIT,
  );
};

const openAndWorkThePlan = async (ctx: Ctx): Promise<void> => {
  seedHeldRun(ctx);
  act(() =>
    useAppStore.getState().navigate({
      to: sessionPlace({
        sessionId: ctx.sessionId,
        lens: 'workflows',
        target: { kind: 'run', runId: RUN_ID },
      }),
    }),
  );
  await settle();
  act(() => openPlanDrawer({ sessionId: ctx.sessionId, planId: PLAN_ID }));
  await settle();
  await visible('button', 'More plan actions');
  expect(screen.getByTestId('plan-primary').textContent).toBe('Approve');

  await comment();
  expect(screen.getByTestId('plan-primary').getAttribute('data-filled')).toBe('false');
  await click(screen.getByRole('button', { name: 'Send to planner' }));
  await waitFor(
    () =>
      expect(screen.getByTestId('plan-drawer-note').textContent).toBe('v2 · Revised by planner'),
    WAIT,
  );

  await click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.change(await screen.findByRole('textbox', undefined, WAIT), {
    target: { value: EDITED_SOURCE },
  });
  await click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(
    () => expect(screen.getByTestId('plan-drawer-note').textContent).toBe('v3 · Edited by you'),
    WAIT,
  );

  await click(screen.getByTestId('plan-primary'));
  await settle(6);
};

const approvedAndFollowed = async (ctx: Ctx): Promise<void> => {
  await waitFor(() => expect(useAppStore.getState().drawer).toBeNull(), WAIT);
  expect(screen.queryByTestId('plan-drawer')).toBeNull();
  expect(journey.saves).toEqual([2]);
  expect(journey.activations).toEqual([IMPLEMENTER_ID]);
  const run = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === ctx.sessionId)
    ?.workflowRuns.find((candidate) => candidate.id === RUN_ID);
  expect(run?.rulesSnapshot?.planApproved).toBe(true);
  expect(run?.orchestrationStop).toBeUndefined();
  await waitFor(() => expect(screen.getAllByText('Plan approved')).toHaveLength(1), WAIT);
  expect(screen.getAllByText('Implement started')).toHaveLength(1);
  expect(screen.queryAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Follow the run' })).toBeNull();
  const state = useAppStore.getState();
  expect(state.activeLens[ctx.sessionId]).toBe('workflows');
  expect(state.focusedWorkflowRunId[ctx.sessionId]).toBe(RUN_ID);
};

const openPlanThePlannerAsksAbout = async (ctx: Ctx): Promise<void> => {
  seedHeldRun(ctx);
  useAppStore.setState((state) => ({
    sessionOpenQuestions: {
      ...state.sessionOpenQuestions,
      [ctx.sessionId]: [
        aPlannerQuestion({ sessionId: ctx.sessionId, createdByAgentId: PLANNER_ID }),
      ],
    },
    agentTurnState: {
      ...state.agentTurnState,
      [PLANNER_ID]: { kind: 'idle', lastActivityAt: STORY_NOW },
    },
  }));
  act(() =>
    useAppStore.getState().navigate({
      to: sessionPlace({
        sessionId: ctx.sessionId,
        lens: 'workflows',
        target: { kind: 'run', runId: RUN_ID },
      }),
    }),
  );
  await settle();
  act(() => openPlanDrawer({ sessionId: ctx.sessionId, planId: PLAN_ID }));
  await settle();
  await visible('button', 'More plan actions');
};

const askedPlanWaitsThenApproves = async (ctx: Ctx): Promise<void> => {
  await screen.findByTestId('plan-drawer-question', undefined, WAIT);
  expect(screen.getByTestId('artifact-state-detail').textContent).toBe('waiting for your answer');
  expect(screen.queryByText(/Revising/)).toBeNull();
  expect(screen.queryByTestId('plan-drawer-state-line')).toBeNull();
  expect(screen.getByTestId('plan-primary').hasAttribute('disabled')).toBe(true);
  expect(screen.getByTestId('plan-drawer-reason').textContent).toBe(
    'The planner asked a question. Answer it first.',
  );
  expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(1);

  act(() =>
    useAppStore.setState((state) => ({
      sessionOpenQuestions: { ...state.sessionOpenQuestions, [ctx.sessionId]: [] },
    })),
  );
  await settle();
  expect(screen.getByTestId('plan-primary').hasAttribute('disabled')).toBe(false);
  expect(screen.queryByTestId('plan-drawer-question')).toBeNull();
};

const openPlanOverTheOverview = async (ctx: Ctx): Promise<void> => {
  seedHeldRun(ctx);
  act(() => useAppStore.getState().navigate({ to: sessionPlace({ sessionId: ctx.sessionId }) }));
  await settle();
  act(() => openPlanDrawer({ sessionId: ctx.sessionId, planId: PLAN_ID }));
  await settle();
  await visible('button', 'More plan actions');
  expect(screen.getByTestId('plan-primary').textContent).toBe('Approve');
  expect(screen.queryByRole('button', { name: 'Run plan' })).toBeNull();
  await click(screen.getByTestId('plan-primary'));
  await settle(6);
};

const approvedOffTheRunPage = async (ctx: Ctx): Promise<void> => {
  await waitFor(() => expect(useAppStore.getState().drawer).toBeNull(), WAIT);
  expect(screen.queryByTestId('plan-drawer')).toBeNull();
  await waitFor(() => expect(screen.getAllByText('Plan approved')).toHaveLength(1), WAIT);
  expect(screen.getAllByRole('button', { name: 'Follow the run' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Run plan' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Start implementer' })).toBeNull();
  expect(useAppStore.getState().activeLens[ctx.sessionId] ?? null).toBeNull();
};

export const PLAN_DRAWER_ROWS: ReadonlyArray<Row> = [
  {
    name: 'plan drawer: comment, re-plan, edit by hand, Approve closes the drawer and starts the step once',
    covers: ['navigate', 'openDrawer'],
    open: openAndWorkThePlan,
    lands: approvedAndFollowed,
  },
  {
    name: 'plan drawer: a planner question holds Approve off with waiting for your answer, and answering frees it',
    covers: ['navigate', 'openDrawer'],
    open: openPlanThePlannerAsksAbout,
    lands: askedPlanWaitsThenApproves,
  },
  {
    name: 'plan drawer: Approve over the Overview closes the drawer, raises one toast and never offers Run plan',
    covers: ['navigate', 'openDrawer'],
    open: openPlanOverTheOverview,
    lands: approvedOffTheRunPage,
  },
];
