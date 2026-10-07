import { expect } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { markUserStart } from '../../../shared/lib/userStarts';
import { STORY_NOW } from '../../../store/storyHarness';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { type Ctx, type Row, WAIT, settle, useAppStore } from './harness';

const WORKFLOW_ID = 'journey-follow-workflow' as WorkflowId;

let seeded = 0;

let RUN_ID = 'journey-follow-run-0' as WorkflowRunId;

let AGENT_ID = 'journey-follow-agent-0' as AgentId;

const runPage = ({ sessionId }: Ctx) =>
  sessionPlace({ sessionId, lens: 'workflows', target: { kind: 'run', runId: RUN_ID } });

type SeedParams = {
  readonly isQueued: boolean;
};

const seedRun = ({ sessionId }: Ctx, { isQueued }: SeedParams): void => {
  seeded += 1;
  RUN_ID = `journey-follow-run-${seeded}` as WorkflowRunId;
  AGENT_ID = `journey-follow-agent-${seeded}` as AgentId;
  const state = useAppStore.getState();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    throw new Error('the board seed lost its session');
  }
  const workspaceId = session.workspaceId as WorkspaceId;
  const steps = ['Plan', 'Implement'].map((name, ordinal) => ({
    id: `${WORKFLOW_ID}-step-${ordinal}` as StepId,
    workflowId: WORKFLOW_ID,
    ordinal,
    name,
    promptPrefix: '',
  }));
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
    currentStep: 0,
    autoRun: false,
    triggerMode: isQueued ? 'manual' : 'immediate',
    executionMode: 'static',
  };
  const agents: ReadonlyArray<Agent> = isQueued
    ? []
    : [
        {
          id: AGENT_ID,
          sessionId,
          ordinal: 0,
          name: 'Implement',
          workflowRunId: RUN_ID,
          stepId: steps[1]?.id,
          status: 'running',
        },
      ];
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
  });
};

const anotherSession = ({ sessionId }: Ctx): SessionId => {
  const state = useAppStore.getState();
  const workspaceId = state.sessions.find((candidate) => candidate.id === sessionId)?.workspaceId;
  const other = state.sessions.find(
    (candidate) => candidate.id !== sessionId && candidate.workspaceId === workspaceId,
  );
  if (other === undefined) {
    throw new Error('the board seed has no second session in the workspace');
  }
  return other.id;
};

const moveAway = async (ctx: Ctx): Promise<void> => {
  const away = anotherSession(ctx);
  act(() => useAppStore.getState().navigate({ to: sessionPlace({ sessionId: away }) }));
  await settle();
  expect(useAppStore.getState().currentSessionId).toBe(away);
};

const stepStarted = async ({ sessionId }: Ctx): Promise<void> => {
  act(() => {
    window.dispatchEvent(
      new CustomEvent('goodboy:workflow-step-started', {
        detail: { sessionId, agentId: AGENT_ID, stepName: 'Implement' },
      }),
    );
  });
  await settle();
};

const toastCount = (): number =>
  screen.queryAllByRole('button', { name: 'Dismiss notification' }).length;

export const FOLLOW_ROWS: ReadonlyArray<Row> = [
  {
    name: 'Start on the run page: the start lands there, so no second toast',
    covers: ['navigate', 'toast:follow'],
    open: async (ctx) => {
      seedRun(ctx, { isQueued: true });
      act(() => useAppStore.getState().navigate({ to: runPage(ctx) }));
      await settle();
      fireEvent.click(await screen.findByRole('button', { name: 'Start' }, WAIT));
      await settle(6);
    },
    lands: async (ctx) => {
      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.activeLens[ctx.sessionId] ?? null).toBe('workflows');
        expect(state.focusedWorkflowRunId[ctx.sessionId]).toBe(RUN_ID);
        expect(
          state.sessions
            .find((candidate) => candidate.id === ctx.sessionId)
            ?.workflowRuns.find((run) => run.id === RUN_ID)?.triggerMode,
        ).toBe('immediate');
      }, WAIT);
      expect(toastCount()).toBe(0);
      expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
    },
  },
  {
    name: 'A step the orchestrator starts while you are elsewhere: one toast, Follow lands on its agent',
    covers: ['navigate', 'toast:follow'],
    open: async (ctx) => {
      seedRun(ctx, { isQueued: false });
      await moveAway(ctx);
      await stepStarted(ctx);
    },
    lands: async (ctx) => {
      expect(await screen.findByText('Implement started', {}, WAIT)).toBeDefined();
      expect(toastCount()).toBe(1);

      fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
      await settle();

      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.currentSessionId).toBe(ctx.sessionId);
        expect(state.selectedAgentId[ctx.sessionId]).toBe(AGENT_ID);
      }, WAIT);
      expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
    },
  },
  {
    name: 'A step the user just started is not announced a second time',
    covers: ['toast:follow'],
    open: async (ctx) => {
      seedRun(ctx, { isQueued: false });
      await moveAway(ctx);
      markUserStart({ key: RUN_ID });
      await stepStarted(ctx);
    },
    lands: async () => {
      expect(toastCount()).toBe(0);
    },
  },
];
