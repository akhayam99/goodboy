import type { Agent, Session, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  AGENT_ROUNDING_ID,
  FLOW_AGENTS,
  FLOW_SESSION,
  FLOW_SESSION_ID,
  NOW,
  SESSIONS,
} from './fixtures';
import { seedWorkflowRun } from './seeds';

const PLAN_GUIDANCE = [
  '- Group the commits by concern at the end.',
  '- Never run the integration tests.',
  '- Open the PR as a draft.',
].join('\n');

const PLAN_APPROVAL_MESSAGE = 'The plan is ready. Approve it to start the rest of the run.';

const isPlanned = (agent: Agent): boolean => agent.kind === 'scout' || agent.kind === 'planner';

const pendingOf = (agent: Agent): Agent => {
  const { completedAt, lastFinishedAt, lastViewedAt, doneAt, startedAt, ...rest } = agent;
  return { ...rest, status: 'pending', outputSummary: '' };
};

const PLAN_HOLD_AGENTS: ReadonlyArray<Agent> = FLOW_AGENTS.map((agent) =>
  isPlanned(agent) ? agent : pendingOf(agent),
);

const [BASE_RUN, ...OTHER_RUNS] = FLOW_SESSION.workflowRuns;

const staticOf = (run: WorkflowRun): WorkflowRun => {
  const { orchestratorSummary, orchestratorHints, orchestratorRouting, ...rest } = run;
  return rest;
};

const PLAN_HOLD_RUN: WorkflowRun = {
  ...staticOf(BASE_RUN!),
  executionMode: 'static',
  autoRun: false,
  currentStep: 2,
  orchestrationStop: { kind: 'plan-approval', message: PLAN_APPROVAL_MESSAGE },
  rulesSnapshot: {
    autonomy: 'plan',
    spendLimitUsd: 12,
    spendLimitMode: 'pause',
    spreadByHeadroom: false,
    standingGuidance: PLAN_GUIDANCE,
    guidanceRoles: ['implementer', 'docs'],
  },
};

export const PLAN_HOLD_SESSION: Session = {
  ...FLOW_SESSION,
  state: { kind: 'idle', lastActivityAt: NOW },
  workflowRuns: [PLAN_HOLD_RUN, ...OTHER_RUNS],
};

export const seedWorkflowRunPlanHold = () => {
  seedWorkflowRun();
  useAppStore.setState({
    sessions: SESSIONS.map((session) =>
      session.id === FLOW_SESSION_ID ? PLAN_HOLD_SESSION : session,
    ),
    sessionPhaseRuns: { [FLOW_SESSION_ID]: PLAN_HOLD_AGENTS },
    agentTurnState: {},
    selectedAgentId: { [FLOW_SESSION_ID]: AGENT_ROUNDING_ID },
  });
};
