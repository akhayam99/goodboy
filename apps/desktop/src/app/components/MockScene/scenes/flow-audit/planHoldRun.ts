import type {
  Agent,
  OpenQuestion,
  OpenQuestionId,
  PlanArtifact,
  PlanWithCount,
  ProviderRunId,
  Session,
  WorkflowRun,
} from '@goodboy/types';
import { planAsArtifact } from '../../../../../features/plans/planAsArtifact';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import {
  AGENT_ROUNDING_ID,
  CHAT_PLANS,
  DYNAMIC_RUN_ID,
  FLOW_AGENTS,
  FLOW_SESSION,
  FLOW_SESSION_ID,
  NOW,
  SESSIONS,
} from './fixtures';
import { seedWorkflowRun } from './seeds';

const clock = sceneClock({ anchor: '2026-09-16T11:20:00.000Z' });

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

const PLANNER: Agent = PLAN_HOLD_AGENTS.find((agent) => agent.kind === 'planner')!;

const PLANNER_RUN_ID = 'mock-flow-provider-run-plan-revise' as ProviderRunId;

const [BASE_RUN, ...OTHER_RUNS] = FLOW_SESSION.workflowRuns;

const staticOf = (run: WorkflowRun): WorkflowRun => {
  const { orchestratorSummary, orchestratorHints, orchestratorRouting, ...rest } = run;
  return rest;
};

const dynamicHoldOf = (run: WorkflowRun): WorkflowRun => {
  const { orchestratorSummary, ...rest } = run;
  return rest;
};

const PLAN_HOLD_RULES: NonNullable<WorkflowRun['rulesSnapshot']> = {
  autonomy: 'plan',
  spendLimitUsd: 12,
  spendLimitMode: 'pause',
  spreadByHeadroom: false,
  standingGuidance: PLAN_GUIDANCE,
  guidanceRoles: ['implementer', 'docs'],
};

const PLAN_HOLD_RUN: WorkflowRun = {
  ...staticOf(BASE_RUN!),
  executionMode: 'static',
  autoRun: false,
  currentStep: 2,
  orchestrationStop: { kind: 'plan-approval', message: PLAN_APPROVAL_MESSAGE },
  rulesSnapshot: PLAN_HOLD_RULES,
};

const PLAN_HOLD_DYNAMIC_RUN: WorkflowRun = {
  ...dynamicHoldOf(BASE_RUN!),
  autoRun: false,
  currentStep: 2,
  orchestrationStop: { kind: 'plan-approval', message: PLAN_APPROVAL_MESSAGE },
  rulesSnapshot: PLAN_HOLD_RULES,
};

export const PLAN_HOLD_SESSION: Session = {
  ...FLOW_SESSION,
  state: { kind: 'idle', lastActivityAt: NOW },
  workflowRuns: [PLAN_HOLD_RUN, ...OTHER_RUNS],
};

export const PLAN_HOLD_DYNAMIC_SESSION: Session = {
  ...FLOW_SESSION,
  state: { kind: 'idle', lastActivityAt: NOW },
  workflowRuns: [PLAN_HOLD_DYNAMIC_RUN, ...OTHER_RUNS],
};

const WRITTEN_PLAN = CHAT_PLANS[0]!;

export const PLAN_HOLD_PLAN: PlanWithCount = {
  id: 'mock-flow-plan-dedupe-held' as PlanWithCount['id'],
  sessionId: FLOW_SESSION_ID,
  agentId: PLANNER.id,
  workflowRunId: DYNAMIC_RUN_ID,
  title: WRITTEN_PLAN.title,
  bodyMd: WRITTEN_PLAN.bodyMd,
  status: 'active',
  createdAt: clock.iso({ at: '2026-09-16T09:41:00.000Z' }),
  updatedAt: clock.iso({ at: '2026-09-16T09:41:00.000Z' }),
  consumptionCount: 0,
};

const PLAN_HOLD_ARTIFACT: PlanArtifact = {
  ...planAsArtifact({ plan: PLAN_HOLD_PLAN, stored: null }),
  sourceTurnId: 'mock-flow-provider-run-plan',
};

const PLANNER_QUESTION: OpenQuestion = {
  id: 'mock-flow-question-plan-window' as OpenQuestionId,
  sessionId: FLOW_SESSION_ID,
  workflowRunId: DYNAMIC_RUN_ID,
  createdByAgentId: PLANNER.id,
  text: 'Should the plan keep the retry window at five minutes, or follow the relay setting?',
  suggestedAnswers: ['Keep five minutes', 'Follow the relay setting'],
  recommendedAnswer: 'Follow the relay setting',
  selectMode: 'one',
  isBlocking: false,
  userAnswer: null,
  status: 'open',
  createdAt: clock.iso({ at: '2026-09-16T11:12:00.000Z' }),
};

type HoldParams = {
  readonly session: Session;
};

const seedHold = ({ session }: HoldParams): void => {
  seedWorkflowRun();
  const state = useAppStore.getState();
  useAppStore.setState({
    sessions: SESSIONS.map((candidate) => (candidate.id === FLOW_SESSION_ID ? session : candidate)),
    sessionPhaseRuns: { [FLOW_SESSION_ID]: PLAN_HOLD_AGENTS },
    agentTurnState: {},
    selectedAgentId: { [FLOW_SESSION_ID]: AGENT_ROUNDING_ID },
    sessionPlans: { ...state.sessionPlans, [FLOW_SESSION_ID]: [PLAN_HOLD_PLAN] },
    sessionArtifacts: { ...state.sessionArtifacts, [FLOW_SESSION_ID]: [PLAN_HOLD_ARTIFACT] },
  });
};

export const seedWorkflowRunPlanHold = (): void => seedHold({ session: PLAN_HOLD_SESSION });

export const seedWorkflowRunPlanHoldDynamic = (): void =>
  seedHold({ session: PLAN_HOLD_DYNAMIC_SESSION });

export const seedWorkflowRunPlanQuestion = (): void => {
  seedHold({ session: PLAN_HOLD_DYNAMIC_SESSION });
  useAppStore.setState({
    sessionOpenQuestions: { [FLOW_SESSION_ID]: [PLANNER_QUESTION] },
    agentTurnState: {
      [PLANNER.id]: {
        kind: 'blocked',
        runId: PLANNER_RUN_ID,
        blockedAt: clock.iso({ at: '2026-09-16T11:12:00.000Z' }),
      },
    },
  });
};
