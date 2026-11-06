import type { AgentId, SessionId } from '@goodboy/types';
import { askBatchAfterAnswer } from './askBatchAfterAnswer';
import { heldOnceAllowsOf } from './heldOnceAllowsOf';
import { NO_RESOLVED_ASKS } from './noResolvedAsks';
import type { GetFn } from './types';
import { withHeldAnswers } from './withHeldAnswers';
import { sessionById } from '../sessions/sessionIndex';
import { throwIfRefused } from '../turn/refusal/throwIfRefused';

type Params = {
  sessionId: SessionId;
  agentId: AgentId;
  toolName: string;
  toolUseId: string;
};

const composeRetryPrompt = ({ toolName }: Pick<Params, 'toolName'>): string =>
  [
    `Permission for ${toolName} is now granted.`,
    'Retry the tool call that was blocked, then continue where you stopped.',
  ].join('\n');

export const retryBlockedTool = (get: GetFn) => {
  return async ({ sessionId, agentId, toolName, toolUseId }: Params): Promise<void> => {
    const session = sessionById(get().sessions, sessionId);
    if (session == null) {
      return;
    }
    if (get().agentTurnState[agentId]?.kind === 'running') {
      return;
    }
    const { isWaiting, held } = askBatchAfterAnswer({
      transcripts: get().transcripts,
      agentId,
      toolUseId,
    });
    if (isWaiting) {
      return;
    }
    throwIfRefused({
      result: await get().sendTurn({
        sessionId,
        agentId,
        content: withHeldAnswers({ held, prompt: composeRetryPrompt({ toolName }) }),
        resolvedAsks: NO_RESOLVED_ASKS,
        ...(held.length > 0 && { permissionOnceAllows: heldOnceAllowsOf({ held }) }),
      }),
    });
  };
};
