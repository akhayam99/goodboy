import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  clearPendingOpenQuestionDelivery,
  failPendingOpenQuestionDelivery,
} from './pendingOpenQuestionDelivery';
import { sendAnswersToSettledAgents } from './sendAnswersToSettledAgents';
import type { GetFn, SetFn } from './types';

type RetryParams = {
  readonly sessionId: SessionId;
  readonly attemptId: string;
};

type FactoryParams = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const retryOpenQuestionDelivery = ({ set, get }: FactoryParams) => {
  return async ({ sessionId, attemptId }: RetryParams): Promise<void> => {
    const pending = get().pendingOpenQuestionDeliveries[sessionId];
    if (pending === undefined || pending.attemptId !== attemptId) {
      return;
    }
    try {
      await sendAnswersToSettledAgents({
        get,
        sessionId,
        askingAgentIds: new Set(pending.askingAgentIds),
      });
      clearPendingOpenQuestionDelivery({ set, sessionId, attemptId });
    } catch (cause) {
      failPendingOpenQuestionDelivery({ set, sessionId, attemptId, error: formatError(cause) });
    } finally {
      void get().maybeAutoAdvanceWorkflow(sessionId);
    }
  };
};
