import { expect } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import { STORY_NOW } from '../../../store/storyHarness';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { type Ctx, type Row, WAIT, settle, useAppStore } from './harness';

const WORKFLOW_ID = 'journey-run-tree-workflow' as WorkflowId;
const RUN_ID = 'journey-run-tree-run' as WorkflowRunId;
const IMPLEMENT_ID = 'journey-run-tree-implement' as AgentId;

const SCOUT_NAMES = [
  'Read the credit writer in payments-api',
  'Find the webhook tests that cover a retry',
  'Check the unique key on the credits table',
] as const;

const scoutId = ({ index }: { readonly index: number }): AgentId =>
  `journey-run-tree-scout-${index}` as AgentId;

const minute = ({ value }: { readonly value: number }): string =>
  new Date(Date.parse(STORY_NOW) - (60 - value) * 60_000).toISOString();

const seedRun = ({ sessionId }: Ctx): void => {
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
    currentStep: 1,
    autoRun: false,
    triggerMode: 'immediate',
    executionMode: 'static',
  };
  const implement: Agent = {
    id: IMPLEMENT_ID,
    sessionId,
    ordinal: 1,
    name: 'Implement',
    workflowRunId: RUN_ID,
    stepId: steps[1]?.id,
    status: 'running',
    startedAt: minute({ value: 10 }) as Agent['startedAt'],
  };
  const scouts: ReadonlyArray<Agent> = SCOUT_NAMES.map((name, index) => ({
    id: scoutId({ index }),
    sessionId,
    ordinal: 10 + index,
    name,
    workflowRunId: RUN_ID,
    parentAgentId: IMPLEMENT_ID,
    status: 'completed',
    startedAt: minute({ value: 11 + index }) as Agent['startedAt'],
    completedAt: minute({ value: 12 + index }) as Agent['completedAt'],
  }));
  useAppStore.setState({
    phaseTemplates: { ...state.phaseTemplates, [workspaceId]: [workflow] },
    sessions: state.sessions.map((candidate) =>
      candidate.id === sessionId
        ? { ...candidate, workflowRuns: [...candidate.workflowRuns, run] }
        : candidate,
    ),
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: [...(state.sessionPhaseRuns[sessionId] ?? []), implement, ...scouts],
    },
    agentKindOverride: {
      ...state.agentKindOverride,
      ...Object.fromEntries(scouts.map((scout) => [scout.id, 'scout' as const])),
    },
  });
};

const openFinishedRun = async (ctx: Ctx): Promise<void> => {
  seedRun(ctx);
  act(() =>
    useAppStore.getState().navigate({
      to: sessionPlace({
        sessionId: ctx.sessionId as SessionId,
        lens: 'workflows',
        target: { kind: 'run', runId: RUN_ID },
      }),
    }),
  );
  await settle();
};

const FOLD_LABEL = /^3 scouts · done/u;

const foldButton = async (): Promise<HTMLElement> =>
  within(await screen.findByTestId('run-tree-fold-row', {}, WAIT)).getByRole('button');

const scoutRows = (): ReadonlyArray<string> =>
  screen
    .queryAllByTestId(/^run-tree-row-journey-run-tree-scout-/u)
    .map((row) => row.querySelector('[title]')?.getAttribute('title') ?? '');

const foldAndOpenFromTheKeyboard = async (): Promise<void> => {
  const user = userEvent.setup();
  const fold = await foldButton();

  expect(fold.getAttribute('aria-label')).toMatch(FOLD_LABEL);
  expect(screen.getAllByTestId('run-tree-fold-row')).toHaveLength(1);
  expect(scoutRows()).toEqual([]);

  fold.focus();
  await user.keyboard('{Enter}');
  await waitFor(() => expect(scoutRows()).toEqual([...SCOUT_NAMES]), WAIT);
  expect((await foldButton()).getAttribute('aria-expanded')).toBe('true');

  await user.keyboard('{Enter}');
  await waitFor(() => expect(scoutRows()).toEqual([]), WAIT);
  expect((await foldButton()).getAttribute('aria-expanded')).toBe('false');
};

export const RUN_TREE_ROWS: ReadonlyArray<Row> = [
  {
    name: 'Run page of a run whose scouts finished: one fold row, Enter opens the scouts in order, Enter folds them again',
    covers: ['navigate'],
    open: openFinishedRun,
    lands: foldAndOpenFromTheKeyboard,
  },
];
