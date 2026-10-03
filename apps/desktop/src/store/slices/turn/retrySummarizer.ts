import type { SessionId, TaskModelPreference } from '@goodboy/types';
import { CONTEXT_UPDATE_REASON } from './requestContextUpdate';
import { enqueueContextConsolidation, enqueueSummarizer } from './turnHelpers';
import type { GetFn, SetFn } from './types';

export const retrySummarizer = (set: SetFn, get: GetFn) => {
  return (sessionId: SessionId, taskModelOverride?: TaskModelPreference) => {
    const status = get().summarizerStatus[sessionId];
    if (!status || status.status === 'running') {
      return;
    }
    if (!status.lastAttempt) {
      return;
    }
    const isConsolidation =
      status.lastAttempt.turnInput === '' && status.lastAttempt.turnOutput === '';
    if (isConsolidation && taskModelOverride === undefined) {
      enqueueContextConsolidation({
        set,
        get,
        sessionId,
        after: CONTEXT_UPDATE_REASON,
        isRequested: true,
      });
      return;
    }
    enqueueSummarizer({
      set,
      get,
      sessionId,
      turnInput: status.lastAttempt.turnInput,
      turnOutput: status.lastAttempt.turnOutput,
      workingDir: status.lastAttempt.workingDir,
      ...(taskModelOverride !== undefined && { taskModelOverride }),
    });
  };
};
