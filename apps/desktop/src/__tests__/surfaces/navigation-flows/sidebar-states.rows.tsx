import { expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { aWorkflowRun } from '@goodboy/types/testing';
import type { ProviderRunId, Session, SessionId, WorkflowRunId } from '@goodboy/types';
import { openQuestionFor } from '../../../features/workspace/testing/sessionColumn';
import { pressShortcut } from '../../helpers/pressKey';
import { type Row, WAIT, heading, lens, settle, useAppStore } from './harness';

const HELD_RUN_ID = 'sidebar-states-run-held' as WorkflowRunId;

const siblingOf = ({
  current,
  id,
  goal,
  updatedAt,
  over,
}: {
  readonly current: Session;
  readonly id: string;
  readonly goal: string;
  readonly updatedAt: string;
  readonly over: Partial<Session>;
}): Session => ({
  ...current,
  id: id as SessionId,
  goal,
  contextSlots: [],
  workflowRuns: [],
  activeProjectId: undefined,
  createdAt: '2026-09-01T09:00:00.000Z' as Session['createdAt'],
  updatedAt: updatedAt as Session['updatedAt'],
  ...over,
});

const seedWaitingWork = (sessionId: SessionId): void => {
  const state = useAppStore.getState();
  const current = state.sessions.find((session) => session.id === sessionId);
  if (current === undefined) {
    throw new Error('the board seed lost its open session');
  }
  const running = siblingOf({
    current,
    id: 'sidebar-states-running',
    goal: 'Tune the rate limiter',
    updatedAt: '2026-10-02T09:00:00.000Z',
    over: {
      state: {
        kind: 'running',
        runId: 'sidebar-states-provider-run' as ProviderRunId,
        startedAt: '2026-10-02T08:55:00.000Z' as Session['createdAt'],
      },
    },
  });
  const held = siblingOf({
    current,
    id: 'sidebar-states-held',
    goal: 'Plan the Cascadia onboarding',
    updatedAt: '2026-10-03T09:00:00.000Z',
    over: {
      workflowRuns: [
        aWorkflowRun({
          id: HELD_RUN_ID,
          orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
        }),
      ],
    },
  });
  useAppStore.setState({
    sessions: [{ ...current, state: { kind: 'draft' } }, running, held],
    sessionGithub: {},
    mountGithub: {},
    sessionResolveThreads: {},
    agentTurnState: {},
    sessionPhaseRuns: {},
    sessionOpenQuestions: {
      [running.id]: [openQuestionFor({ sessionId: running.id as SessionId })],
    },
  });
};

const pressNextNeedsYou = async (): Promise<void> => {
  pressShortcut({ id: 'session.nextNeedsYou', target: document.body });
  await settle();
};

export const SIDEBAR_STATE_ROWS: ReadonlyArray<Row> = [
  {
    name: 'key session.nextNeedsYou: a running session with a question, then a held plan on its run page',
    covers: ['navigate'],
    open: async (ctx) => {
      seedWaitingWork(ctx.sessionId);
      await settle();

      await pressNextNeedsYou();
      await waitFor(() => {
        expect(useAppStore.getState().currentSessionId).toBe('sidebar-states-running');
        expect(useAppStore.getState().activeLens['sidebar-states-running' as SessionId]).toBe(
          'questions',
        );
      }, WAIT);

      await pressNextNeedsYou();
    },
    lands: async () => {
      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.currentSessionId).toBe('sidebar-states-held');
        expect(state.activeLens['sidebar-states-held' as SessionId]).toBe('workflows');
        expect(state.focusedWorkflowRunId['sidebar-states-held' as SessionId]).toBe(HELD_RUN_ID);
      }, WAIT);
      await lens('workflows')({ sessionId: 'sidebar-states-held' as SessionId });
      await heading('Runs');
    },
  },
];
