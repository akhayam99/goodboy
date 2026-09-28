import type { Agent, AgentId, Session, TurnState, WorkflowRun } from '@goodboy/types';
import { sceneClock } from '../../sceneClock';
import { FLOW_AGENTS, FLOW_SESSION, FLOW_TELEMETRY, NOW, SESSIONS } from './fixtures';

const clock = sceneClock({ anchor: '2026-09-16T11:20:00.000Z' });

type ScoutTiming = Readonly<{
  startedAt: string;
  completedAt?: string;
}>;

const SCOUT_TIMING: Readonly<Record<number, ScoutTiming>> = {
  0: { startedAt: '2026-09-16T11:08:00.000Z' },
  0.1: { startedAt: '2026-09-16T11:09:00.000Z', completedAt: '2026-09-16T11:16:00.000Z' },
  0.2: { startedAt: '2026-09-16T11:09:20.000Z' },
  0.3: { startedAt: '2026-09-16T11:09:40.000Z' },
};

const parallelScoutOf = (agent: Agent): Agent => {
  const timing = SCOUT_TIMING[agent.ordinal];
  const { completedAt, lastFinishedAt, lastViewedAt, doneAt, ...rest } = agent;
  if (timing === undefined) {
    return agent;
  }
  if (timing.completedAt === undefined) {
    return {
      ...rest,
      status: 'running',
      outputSummary: '',
      startedAt: clock.iso({ at: timing.startedAt }),
    };
  }
  const finishedAt = clock.iso({ at: timing.completedAt });
  return {
    ...rest,
    startedAt: clock.iso({ at: timing.startedAt }),
    completedAt: finishedAt,
    lastFinishedAt: finishedAt,
    lastViewedAt: lastViewedAt ?? finishedAt,
    doneAt: doneAt ?? finishedAt,
  };
};

const pendingOf = (agent: Agent): Agent => {
  const { completedAt, lastFinishedAt, lastViewedAt, doneAt, ...rest } = agent;
  return { ...rest, status: 'pending', outputSummary: '', startedAt: NOW };
};

export const PARALLEL_AGENTS: ReadonlyArray<Agent> = FLOW_AGENTS.map((agent) =>
  agent.kind === 'scout' ? parallelScoutOf(agent) : pendingOf(agent),
);

const SCOUT_RUN_IDS = new Set(
  PARALLEL_AGENTS.filter((agent) => agent.kind === 'scout').map((agent) => agent.runId),
);

export const PARALLEL_TELEMETRY = FLOW_TELEMETRY.filter((record) =>
  SCOUT_RUN_IDS.has(record.runId),
);

const [BASE_RUN, ...OTHER_RUNS] = FLOW_SESSION.workflowRuns;

const PARALLEL_RUN: WorkflowRun = {
  ...BASE_RUN!,
  currentStep: 0,
  orchestratorHints: (BASE_RUN?.orchestratorHints ?? []).filter(
    (hint) => hint.consumedAtStep === undefined || hint.consumedAtStep === 1,
  ),
  orchestratorSummary:
    'Three scouts are reading ledger-core, payments-api and notify-relay at the same time. One has reported; the plan starts when the other two finish.',
};

const turnOf = (agent: Agent): TurnState | null =>
  agent.status === 'running' && agent.runId !== undefined && agent.startedAt !== undefined
    ? { kind: 'running', runId: agent.runId, startedAt: agent.startedAt }
    : null;

export const PARALLEL_TURNS: Readonly<Record<AgentId, TurnState>> = Object.fromEntries(
  PARALLEL_AGENTS.flatMap((agent) => {
    const turn = turnOf(agent);
    return turn === null ? [] : [[agent.id, turn]];
  }),
);

const FIRST_TURN = PARALLEL_AGENTS.map(turnOf).find((turn) => turn !== null);

export const PARALLEL_SESSION: Session = {
  ...FLOW_SESSION,
  state: FIRST_TURN ?? FLOW_SESSION.state,
  workflowRuns: [PARALLEL_RUN, ...OTHER_RUNS],
};

export const PARALLEL_SESSIONS: ReadonlyArray<Session> = SESSIONS.map((session) =>
  session.id === PARALLEL_SESSION.id ? PARALLEL_SESSION : session,
);
