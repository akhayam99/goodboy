import type { AgentId, SessionId } from '@goodboy/types';
import type { GetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

type Params = {
  sessionId: SessionId;
  agentId: AgentId;
  toolName: string;
};

const composeRetryPrompt = ({ toolName }: Pick<Params, 'toolName'>): string =>
  [
    `Permission for ${toolName} is now granted.`,
    'Retry the tool call that was blocked, then continue where you stopped.',
  ].join('\n');

export const retryBlockedTool = (get: GetFn) => {
  return async ({ sessionId, agentId, toolName }: Params): Promise<void> => {
    const session = sessionById(get().sessions, sessionId);
    if (session == null) {
      return;
    }
    if (get().agentTurnState[agentId]?.kind === 'running') {
      return;
    }
    await get().sendTurn({ sessionId, agentId, content: composeRetryPrompt({ toolName }) });
  };
};
