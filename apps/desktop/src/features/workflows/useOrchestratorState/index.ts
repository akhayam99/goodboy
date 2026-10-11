import type { Agent, OpenQuestion, PlanWithCount, SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../store/store';
import { usePlanRevising } from '../../plans/useRevisingPlans';
import {
  workflowRunHasOpenQuestions,
  workflowRunOpenQuestions,
} from '../../context/openQuestionsGate';
import {
  NO_PLAN_SIGNAL,
  resolveOrchestratorState,
  type OrchestratorState,
  type PlanSignal,
} from '../components/OrchestratorStrip/orchestratorState';

const EMPTY_QUESTIONS: ReadonlyArray<OpenQuestion> = [];

type Params = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
  readonly plan: PlanWithCount | null;
  readonly isOrchestrating: boolean;
  readonly costUsd: number;
};

export type OrchestratorView = {
  readonly state: OrchestratorState;
  readonly planQuestion: OpenQuestion | null;
  readonly runQuestion: OpenQuestion | null;
};

export const useOrchestratorState = ({
  sessionId,
  run,
  agents,
  plan,
  isOrchestrating,
  costUsd,
}: Params): OrchestratorView => {
  const openQuestions = useAppStore(
    (state) => state.sessionOpenQuestions[sessionId] ?? EMPTY_QUESTIONS,
  );
  const planRevising = usePlanRevising({ sessionId, planId: plan?.id ?? null });
  const planQuestion =
    plan === null
      ? null
      : (openQuestions.find(
          (question) => question.status === 'open' && question.createdByAgentId === plan.agentId,
        ) ?? null);
  const planSignal: PlanSignal =
    planQuestion !== null
      ? { kind: 'question', question: planQuestion }
      : planRevising.kind === 'revising'
        ? { kind: 'revising' }
        : NO_PLAN_SIGNAL;
  const runQuestion = workflowRunOpenQuestions({ questions: openQuestions, run })[0] ?? null;
  const state = resolveOrchestratorState({
    run,
    agents,
    isOrchestrating,
    hasOpenQuestions: workflowRunHasOpenQuestions({ questions: openQuestions, run }),
    question: runQuestion,
    costUsd,
    plan: planSignal,
  });
  return { state, planQuestion, runQuestion };
};
