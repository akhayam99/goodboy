import type { Agent, AgentStoppedBy, OpenQuestion, Step, WorkflowRun } from '@goodboy/types';
import type { WorkflowAdvanceState } from '../workflows/advanceGate';
import { isAgentClosedByUser } from '../session/agent-lifecycle';
import { isWorkflowRunClosedByUser } from '../workflows/isWorkflowRunClosedByUser';

export type RowPhase = 'queued' | 'running' | 'waiting' | 'failed' | 'done' | 'closed' | 'skipped';

export type RowStateReason =
  | { readonly kind: 'ready'; readonly stepLabel: string | null }
  | { readonly kind: 'question'; readonly stepLabel: string | null }
  | { readonly kind: 'budget'; readonly limitUsd: number | null }
  | { readonly kind: 'failed' }
  | { readonly kind: 'blocked' }
  | { readonly kind: 'needsApproval' }
  | { readonly kind: 'stepFailed'; readonly stepLabel: string | null }
  | { readonly kind: 'stepBlocked'; readonly stepLabel: string | null }
  | { readonly kind: 'orchestratorFailed' }
  | { readonly kind: 'stopped' }
  | { readonly kind: 'agentStopped'; readonly by: AgentStoppedBy }
  | { readonly kind: 'stepStopped'; readonly stepLabel: string | null }
  | { readonly kind: 'deciding' }
  | { readonly kind: 'briefing' }
  | { readonly kind: 'chatTurn' }
  | { readonly kind: 'closed' }
  | { readonly kind: 'skipped' }
  | { readonly kind: 'chained'; readonly afterTitle: string }
  | { readonly kind: 'awaitingFirstMessage' }
  | { readonly kind: 'discarded' };

export type RowAsk =
  | { readonly kind: 'answer'; readonly question: OpenQuestion | null }
  | { readonly kind: 'runStep'; readonly step: Step; readonly agent: Agent }
  | { readonly kind: 'restartStep' }
  | { readonly kind: 'continue'; readonly agent: Agent };

export type RowState = {
  readonly phase: RowPhase;
  readonly reason: RowStateReason | null;
  readonly ask: RowAsk | null;
};

export const DONE_ROW_STATE: RowState = { phase: 'done', reason: null, ask: null };

export const isRowNeedingYou = ({ state }: { readonly state: RowState }): boolean =>
  state.ask != null && state.ask.kind !== 'continue';

type AgentParams = {
  readonly agent: Agent;
  readonly isAsking: boolean;
  readonly question: OpenQuestion | null;
  readonly isReadyStep: boolean;
};

const isAwaitingFirstMessage = ({ agent }: { readonly agent: Agent }): boolean =>
  agent.stepId == null &&
  agent.workflowRunId == null &&
  agent.parentAgentId == null &&
  agent.startedAt == null &&
  agent.lastFinishedAt == null &&
  agent.kind !== 'resolver';

export const resolveAgentRowState = ({
  agent,
  isAsking,
  question,
  isReadyStep,
}: AgentParams): RowState => {
  if (isAgentClosedByUser({ agent })) {
    return { phase: 'closed', reason: { kind: 'closed' }, ask: null };
  }
  if (agent.status === 'failed') {
    return { phase: 'failed', reason: { kind: 'failed' }, ask: null };
  }
  if (isAsking) {
    return {
      phase: 'waiting',
      reason: { kind: 'question', stepLabel: null },
      ask: { kind: 'answer', question },
    };
  }
  switch (agent.status) {
    case 'running':
      return { phase: 'running', reason: null, ask: null };
    case 'pending':
      if (isReadyStep) {
        return { phase: 'waiting', reason: { kind: 'ready', stepLabel: null }, ask: null };
      }
      return isAwaitingFirstMessage({ agent })
        ? { phase: 'queued', reason: { kind: 'awaitingFirstMessage' }, ask: null }
        : { phase: 'queued', reason: null, ask: null };
    case 'completed':
      return DONE_ROW_STATE;
    case 'skipped':
      return { phase: 'skipped', reason: { kind: 'skipped' }, ask: null };
    case 'blocked':
      return { phase: 'waiting', reason: { kind: 'blocked' }, ask: null };
    case 'stopped':
      return {
        phase: 'waiting',
        reason: { kind: 'agentStopped', by: agent.stoppedBy ?? 'you' },
        ask: { kind: 'continue', agent },
      };
    default: {
      const exhaustive: never = agent.status;
      return exhaustive;
    }
  }
};

export type RowReadyStep = {
  readonly step: Step;
  readonly agent: Agent;
  readonly stepLabel: string | null;
};

export type RowFailedStep = {
  readonly stepLabel: string | null;
  readonly isBlocked: boolean;
};

export type RowStoppedStep = {
  readonly agent: Agent;
  readonly stepLabel: string | null;
};

export type RowWaitingQuestion = {
  readonly question: OpenQuestion;
  readonly stepLabel: string | null;
};

type RunParams = {
  readonly run: WorkflowRun;
  readonly advance: WorkflowAdvanceState | null;
  readonly isFinished: boolean;
  readonly isDeciding: boolean;
  readonly hasRunningStep: boolean;
  readonly failedStep: RowFailedStep | null;
  readonly stoppedStep?: RowStoppedStep | null;
  readonly question: RowWaitingQuestion | null;
  readonly readyStep: RowReadyStep | null;
  readonly chainedAfterTitle: string | null;
};

type WaitingParams = Omit<RunParams, 'isFinished' | 'isDeciding' | 'chainedAfterTitle'>;

const waitingRunState = ({
  run,
  advance,
  failedStep,
  stoppedStep = null,
  question,
  readyStep,
}: WaitingParams): RowState | null => {
  const stop = run.orchestrationStop?.kind ?? null;
  if (stop === 'failure') {
    return { phase: 'failed', reason: { kind: 'orchestratorFailed' }, ask: null };
  }
  if (stop === 'needs-approval') {
    return { phase: 'waiting', reason: { kind: 'needsApproval' }, ask: null };
  }
  if (failedStep?.isBlocked === true) {
    return {
      phase: 'waiting',
      reason: { kind: 'stepBlocked', stepLabel: failedStep.stepLabel },
      ask: { kind: 'restartStep' },
    };
  }
  if (failedStep != null || (advance?.kind === 'blocked' && advance.reason === 'failed-step')) {
    return {
      phase: 'failed',
      reason: { kind: 'stepFailed', stepLabel: failedStep?.stepLabel ?? null },
      ask: { kind: 'restartStep' },
    };
  }
  if (question != null) {
    return {
      phase: 'waiting',
      reason: { kind: 'question', stepLabel: question.stepLabel },
      ask: { kind: 'answer', question: question.question },
    };
  }
  if (stoppedStep != null) {
    return {
      phase: 'waiting',
      reason: { kind: 'stepStopped', stepLabel: stoppedStep.stepLabel },
      ask: { kind: 'continue', agent: stoppedStep.agent },
    };
  }
  if ((advance?.kind === 'blocked' && advance.reason === 'questions') || stop === 'questions') {
    return {
      phase: 'waiting',
      reason: { kind: 'question', stepLabel: null },
      ask: { kind: 'answer', question: null },
    };
  }
  if (advance?.kind === 'ready') {
    return {
      phase: 'waiting',
      reason: { kind: 'ready', stepLabel: readyStep?.stepLabel ?? null },
      ask:
        readyStep == null
          ? null
          : { kind: 'runStep', step: readyStep.step, agent: readyStep.agent },
    };
  }
  if (stop === 'budget') {
    return {
      phase: 'waiting',
      reason: { kind: 'budget', limitUsd: run.spendLimitUsd ?? null },
      ask: null,
    };
  }
  if (stop === 'operator') {
    return { phase: 'closed', reason: { kind: 'stopped' }, ask: null };
  }
  return null;
};

export const resolveRunRowState = (params: RunParams): RowState => {
  const { run, advance, isFinished, isDeciding, hasRunningStep, chainedAfterTitle } = params;
  if (run.discardedAt != null) {
    return { phase: isFinished ? 'done' : 'closed', reason: { kind: 'discarded' }, ask: null };
  }
  if (isWorkflowRunClosedByUser({ run })) {
    return { phase: 'closed', reason: { kind: 'closed' }, ask: null };
  }
  const waiting = waitingRunState(params);
  if (waiting != null) {
    return waiting;
  }
  if (hasRunningStep) {
    return { phase: 'running', reason: null, ask: null };
  }
  if (isDeciding) {
    return { phase: 'running', reason: { kind: 'deciding' }, ask: null };
  }
  if (advance?.kind === 'blocked' && advance.reason === 'summarizer') {
    return { phase: 'running', reason: { kind: 'briefing' }, ask: null };
  }
  if (advance?.kind === 'blocked' && advance.reason === 'turn-running') {
    return { phase: 'running', reason: { kind: 'chatTurn' }, ask: null };
  }
  if (isFinished) {
    return DONE_ROW_STATE;
  }
  if (chainedAfterTitle != null) {
    return {
      phase: 'queued',
      reason: { kind: 'chained', afterTitle: chainedAfterTitle },
      ask: null,
    };
  }
  return { phase: 'queued', reason: null, ask: null };
};
