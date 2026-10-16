import type { AgentId } from '@goodboy/types';
import { TAIL_ACTION } from '../tailAction';
import type { TailFacts } from '../tailFacts';

export type WorkflowRunLiveParams = Readonly<{
  status: 'running' | 'waiting' | 'paused' | 'failed' | 'closed' | 'done';
  stepNumber: number;
  stepCount: number;
  roleNoun: string;
  stepAgentId: AgentId | null;
  failure: string | null;
}>;

export const workflowRunLive = ({
  status,
  stepNumber,
  stepCount,
  roleNoun,
  stepAgentId,
  failure,
}: WorkflowRunLiveParams): TailFacts | null => {
  const step = `Step ${stepNumber} of ${stepCount}`;
  if (status === 'running') {
    return {
      state: 'working',
      phrase: `${step} · ${roleNoun} is working`,
      startedAt: null,
      stepAgentId,
      actions: [TAIL_ACTION.stopStep],
    };
  }
  if (status === 'waiting') {
    return {
      state: 'waiting',
      phrase: `${step} · waiting for your answer`,
      startedAt: null,
      actions: [TAIL_ACTION.answer],
    };
  }
  if (status === 'paused') {
    return {
      state: 'paused',
      phrase: 'Paused at the limit',
      startedAt: null,
      actions: [TAIL_ACTION.raiseLimit, TAIL_ACTION.changeLimit],
    };
  }
  if (status === 'failed') {
    return {
      state: 'failed',
      phrase: `Failed: ${failure ?? `${step} did not finish`}`,
      startedAt: null,
      actions: [TAIL_ACTION.retry, TAIL_ACTION.viewTranscript],
    };
  }
  return null;
};
