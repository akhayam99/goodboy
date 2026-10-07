import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StepId, Workflow, WorkflowId, WorkflowRun, WorkflowRunId } from '@goodboy/types';
import { STORY_NOW } from '../../../store/storyHarness';
import { type Ctx, type Row, WAIT, both, lens, settle, useAppStore } from './harness';

const SHIP_ID = 'flow-workflow-retry-fix' as WorkflowId;
const SHIP_RUN_ID = 'flow-run-retry-fix' as WorkflowRunId;
const SHIP_TITLE = 'Retry the delivery once more';
const OPENS_RUN = 'Open run, Enter';
const MOST_TABS = 120;

const seedRunInActivity = ({ sessionId }: Ctx): void => {
  const state = useAppStore.getState();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    throw new Error('the seeded session is missing');
  }
  const workflow: Workflow = {
    id: SHIP_ID,
    workspaceId: session.workspaceId,
    name: SHIP_TITLE,
    description: '',
    origin: 'orchestrated',
    steps: ['Read the retry state', 'Warn on a stuck delivery'].map((name, ordinal) => ({
      id: `${SHIP_ID}-step-${ordinal}` as StepId,
      workflowId: SHIP_ID,
      ordinal,
      name,
      promptPrefix: '',
    })),
    createdAt: STORY_NOW,
    updatedAt: STORY_NOW,
  };
  const run: WorkflowRun = {
    id: SHIP_RUN_ID,
    workflowId: SHIP_ID,
    ordinal: 0,
    currentStep: 0,
    autoRun: true,
    triggerMode: 'immediate',
    executionMode: 'static',
    goal: 'Let support see a stuck delivery',
    createdAt: STORY_NOW,
  };
  useAppStore.setState({
    sessions: state.sessions.map((candidate) =>
      candidate.id === sessionId ? { ...candidate, workflowRuns: [run] } : candidate,
    ),
    sessionWorkflows: { ...state.sessionWorkflows, [sessionId]: [workflow] },
  });
};

const focusedOpensRun = (): boolean =>
  document.activeElement?.getAttribute('aria-description') === OPENS_RUN;

const tabToRunRow = async (): Promise<void> => {
  const user = userEvent.setup();
  for (let step = 0; step < MOST_TABS && !focusedOpensRun(); step += 1) {
    await user.tab();
  }
  expect(focusedOpensRun()).toBe(true);
};

export const KEYS_ROWS_ROWS: ReadonlyArray<Row> = [
  {
    name: 'activity: Tab to a run row and Enter opens its run page',
    covers: ['navigate', 'row:activity-run'],
    open: async (ctx) => {
      seedRunInActivity(ctx);
      await settle();
      await screen.findByRole('region', { name: 'Activity' });
      await tabToRunRow();
      await userEvent.setup().keyboard('{Enter}');
      await settle();
    },
    lands: both(lens('workflows'), async (ctx) => {
      await waitFor(
        () =>
          expect(useAppStore.getState().focusedWorkflowRunId[ctx.sessionId] ?? null).toBe(
            SHIP_RUN_ID,
          ),
        WAIT,
      );
      expect(
        (await screen.findAllByRole('heading', { name: SHIP_TITLE }, WAIT)).length,
      ).toBeGreaterThan(0);
    }),
  },
];
