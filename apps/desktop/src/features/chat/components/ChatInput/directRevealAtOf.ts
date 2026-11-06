import type { AgentQueuedTurn } from '../../../../store/slices/agentQueue/types';

type Params = {
  readonly turn: AgentQueuedTurn;
};

const REVEAL_AFTER_MS = 500;

export const directRevealAtOf = ({ turn }: Params): number | null => {
  if (turn.isDirect !== true || turn.status !== 'sending') {
    return null;
  }
  return Date.parse(turn.createdAt) + REVEAL_AFTER_MS;
};
