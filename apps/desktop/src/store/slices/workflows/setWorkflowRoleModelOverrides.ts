import type { RoleModelPreferences, SessionId, WorkflowRunId } from '@goodboy/types';
import { updateWorkflowRunRoleModelOverrides } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';

export const setWorkflowRoleModelOverrides = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    overrides: RoleModelPreferences,
  ) => {
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
    if (run == null) {
      return;
    }
    const hasOverrides = Object.keys(overrides).length > 0;
    await updateWorkflowRunRoleModelOverrides(
      tauriDatabase,
      workflowRunId,
      hasOverrides ? overrides : null,
    );
    patchWorkflowRun({
      set,
      sessionId,
      workflowRunId,
      patch: (current) =>
        hasOverrides
          ? { ...current, roleModelOverrides: overrides }
          : withoutKeys(current, ['roleModelOverrides']),
    });
  };
};
