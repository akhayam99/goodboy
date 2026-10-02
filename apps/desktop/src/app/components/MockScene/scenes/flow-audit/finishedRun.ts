import type { Agent, Session, WorkflowRun } from '@goodboy/types';
import { sceneClock } from '../../sceneClock';
import { FLOW_AGENTS, FLOW_SESSION, NOW } from './fixtures';

const clock = sceneClock({ anchor: '2026-09-16T11:20:00.000Z' });

const BACKFILL_DONE_AT = clock.iso({ at: '2026-09-16T10:52:00.000Z' });
const TESTS_STARTED_AT = clock.iso({ at: '2026-09-16T10:54:00.000Z' });
const TESTS_DONE_AT = clock.iso({ at: '2026-09-16T11:06:00.000Z' });

const finishedOf = (agent: Agent): Agent => {
  if (agent.status === 'completed') {
    return agent;
  }
  const completedAt = agent.kind === 'tester' ? TESTS_DONE_AT : BACKFILL_DONE_AT;
  return {
    ...agent,
    status: 'completed',
    outputSummary:
      agent.kind === 'tester'
        ? 'One event delivered three times posts one credit and answers 200 each time.'
        : 'Every retried delivery now records its attempts, tests green.',
    startedAt: agent.kind === 'tester' ? TESTS_STARTED_AT : agent.startedAt,
    completedAt,
    lastFinishedAt: completedAt,
    lastViewedAt: NOW,
    doneAt: completedAt,
  };
};

export const FINISHED_AGENTS: ReadonlyArray<Agent> = FLOW_AGENTS.map(finishedOf);

const [BASE_RUN, ...OTHER_RUNS] = FLOW_SESSION.workflowRuns;

const FINISHED_RUN: WorkflowRun = {
  ...BASE_RUN!,
  currentStep: 4,
  orchestrationOutcome: 'done',
  orchestratorSummary:
    'A repeat event now stops on its event id inside the payments-api transaction, and ledger-core was only read. notify-relay records the attempts on each delivery, and the replay test passes.',
};

export const FINISHED_SESSION: Session = {
  ...FLOW_SESSION,
  state: { kind: 'idle', lastActivityAt: TESTS_DONE_AT },
  workflowRuns: [FINISHED_RUN, ...OTHER_RUNS],
};
