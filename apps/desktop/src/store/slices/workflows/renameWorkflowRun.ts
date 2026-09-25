import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { updateUserWorkflowRunTitle } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import { clampWorkflowTitle } from './titleLimit';
import type { GetFn, SetFn } from './types';

export const renameWorkflowRun = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId, name: string) => {
    const title = clampWorkflowTitle(name);
    if (title.length === 0) {
      throw new Error('workflow run name cannot be empty');
    }
    const prev = get()
      .sessions.find((session) => session.id === sessionId)
      ?.workflowRuns.find((run) => run.id === workflowRunId);
    if (prev == null) {
      throw new Error(`workflow run not found: ${workflowRunId}`);
    }
    patchWorkflowRun({
      set,
      sessionId,
      workflowRunId,
      patch: (run) => ({ ...run, title, titleUserEdited: true }),
    });
    try {
      await updateUserWorkflowRunTitle({ db: tauriDatabase, workflowRunId, title });
    } catch (error) {
      patchWorkflowRun({
        set,
        sessionId,
        workflowRunId,
        patch: (run) => {
          const restored = withoutKeys(run, ['title', 'titleUserEdited']);
          return {
            ...restored,
            ...(prev.title != null && { title: prev.title }),
            ...(prev.titleUserEdited === true && { titleUserEdited: true }),
          };
        },
      });
      throw error;
    }
  };
};
