import { listGoalAttachmentsForRun, listGoalAttachmentsForSession } from '@goodboy/db';
import type { GoalAttachmentOwner, SessionId, WorkflowRunId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const loadGoalAttachments = (set: SetFn, get: GetFn) => {
  return async (owner: GoalAttachmentOwner): Promise<void> => {
    if (owner.type === 'session') {
      const sessionId = owner.id as SessionId;
      if (get().sessionAttachments[sessionId] !== undefined) {
        return;
      }
      const attachments = await listGoalAttachmentsForSession(tauriDatabase, sessionId);
      set((state) => ({
        sessionAttachments: { ...state.sessionAttachments, [sessionId]: attachments },
      }));
      return;
    }
    const runId = owner.id as WorkflowRunId;
    if (get().workflowRunAttachments[runId] !== undefined) {
      return;
    }
    const attachments = await listGoalAttachmentsForRun(tauriDatabase, runId);
    set((state) => ({
      workflowRunAttachments: { ...state.workflowRunAttachments, [runId]: attachments },
    }));
  };
};
