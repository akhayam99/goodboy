import type { AgentId, SessionId } from '@goodboy/types';
import { announceDataChanged } from '../../../shared/lib/dataChanged';
import { turnEventsSaved } from '../transcripts/queue';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const announceAgentTurn = ({ sessionId, agentId }: Params): void => {
  turnEventsSaved()
    .then(() => announceDataChanged({ change: { kind: 'agent-turn', sessionId, agentId } }))
    .catch((error: unknown) => console.warn('telling the other windows failed', error));
};
