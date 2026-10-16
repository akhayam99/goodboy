import type { Agent, TurnState } from '@goodboy/types';
import { formatClock } from '../../../shared/utils/time/formatClock';
import { TAIL_ACTION } from '../tailAction';
import type { TailAction, TailFacts } from '../tailFacts';
import { workingPhraseOf, type LastTool } from '../workingPhraseOf';

export type AgentTurnLiveParams = Readonly<{
  turn: TurnState | null;
  agent: Pick<Agent, 'status' | 'stoppedBy' | 'stoppedAt'>;
  lastTool: LastTool | null;
  project: string | null;
  hasQueuedMessage: boolean;
  stopAction?: TailAction;
}>;

type StoppedParams = {
  readonly agent: AgentTurnLiveParams['agent'];
};

const stoppedPhraseOf = ({ agent }: StoppedParams): string => {
  const when = agent.stoppedAt == null ? '' : ` at ${formatClock({ at: agent.stoppedAt })}`;
  return agent.stoppedBy === 'app' ? `Stopped by restart${when}` : `Stopped by you${when}`;
};

export const agentTurnLive = ({
  turn,
  agent,
  lastTool,
  project,
  hasQueuedMessage,
  stopAction = TAIL_ACTION.stop,
}: AgentTurnLiveParams): TailFacts | null => {
  if (turn?.kind === 'running') {
    return {
      state: hasQueuedMessage ? 'queued' : 'working',
      phrase: workingPhraseOf({ tool: lastTool, project }),
      startedAt: turn.startedAt,
      actions: [stopAction],
    };
  }
  if (turn?.kind === 'starting') {
    return {
      state: 'working',
      phrase: 'Starting',
      startedAt: turn.startedAt,
      actions: [stopAction],
    };
  }
  if (turn?.kind === 'blocked') {
    return {
      state: 'waiting',
      phrase: 'Waiting for your answer',
      startedAt: turn.blockedAt,
      actions: [TAIL_ACTION.answer],
    };
  }
  if (turn?.kind === 'error') {
    return {
      state: 'failed',
      phrase: `Failed: ${turn.message}`,
      startedAt: null,
      actions: [TAIL_ACTION.retry, TAIL_ACTION.viewTranscript],
    };
  }
  if (agent.status === 'stopped') {
    return {
      state: 'stopped',
      phrase: stoppedPhraseOf({ agent }),
      startedAt: null,
      actions: [TAIL_ACTION.continue],
    };
  }
  return null;
};
