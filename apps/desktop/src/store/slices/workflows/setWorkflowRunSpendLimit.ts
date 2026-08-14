import type { SessionId, WorkflowRunId, WorkflowSpendLimitMode } from '@goodboy/types';
import { updateWorkflowRunSpendLimit } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';

export const setWorkflowRunSpendLimit = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    limitUsd: number | null,
    mode: WorkflowSpendLimitMode,
  ) => {
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
    if (run == null) {
      return;
    }
    const nextLimit = limitUsd != null && limitUsd > 0 ? limitUsd : null;
    await updateWorkflowRunSpendLimit(tauriDatabase, workflowRunId, nextLimit, mode);
    patchWorkflowRun({
      set,
      sessionId,
      workflowRunId,
      patch: (current) =>
        nextLimit == null
          ? { ...withoutKeys(current, ['spendLimitUsd']), spendLimitMode: mode }
          : { ...current, spendLimitUsd: nextLimit, spendLimitMode: mode },
    });
  };
};
