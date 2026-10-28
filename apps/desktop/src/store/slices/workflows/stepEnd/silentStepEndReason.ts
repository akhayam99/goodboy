import { isAgentStatusSettled } from '@goodboy/core';
import type { Agent, OpenQuestion, TurnState } from '@goodboy/types';

type Params = {
  readonly agent: Agent | undefined;
  readonly agents: ReadonlyArray<Agent>;
  readonly turn: TurnState | undefined;
  readonly hasActiveTurn: boolean;
  readonly hasPendingContinuation: boolean;
  readonly questions: ReadonlyArray<OpenQuestion>;
};

const LIVE_TURN_KINDS: ReadonlySet<string> = new Set(['running', 'starting', 'blocked']);

export const silentStepEndReason = ({
  agent,
  agents,
  turn,
  hasActiveTurn,
  hasPendingContinuation,
  questions,
}: Params): string | null => {
  if (agent === undefined || agent.stepId == null || agent.workflowRunId == null) {
    return null;
  }
  if (agent.status !== 'running') {
    return null;
  }
  if (hasActiveTurn || hasPendingContinuation) {
    return null;
  }
  if (turn !== undefined && LIVE_TURN_KINDS.has(turn.kind)) {
    return null;
  }
  const isWaitingOnChild = agents.some(
    (candidate) =>
      candidate.parentAgentId === agent.id && !isAgentStatusSettled({ status: candidate.status }),
  );
  if (isWaitingOnChild) {
    return null;
  }
  const isWaitingOnUser = questions.some(
    (question) =>
      question.status === 'open' &&
      question.userAnswer === null &&
      question.createdByAgentId === agent.id,
  );
  if (isWaitingOnUser) {
    return null;
  }
  return 'the turn ended, the step is still running, and nothing continues it or waits on you';
};
