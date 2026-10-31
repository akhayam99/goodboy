import { listGoalAttachmentsForRun, listGoalAttachmentsForSession } from '@goodboy/db';
import type { GoalAttachmentOwner, SessionId, WorkflowRunId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { attachmentReadKey } from './attachmentReadKey';
import { attachmentReads } from './attachmentReads';
import type { GetFn, SetFn } from './types';

type OwnerParams = {
  readonly owner: GoalAttachmentOwner;
};

export const loadGoalAttachments = (set: SetFn, get: GetFn) => {
  const inFlight = new Map<string, Promise<void>>();

  const loadOwner = async ({ owner }: OwnerParams): Promise<void> => {
    const key = attachmentReadKey({ owner });
    if (owner.type === 'session') {
      const sessionId = owner.id as SessionId;
      if (get().sessionAttachments[sessionId] !== undefined) {
        return;
      }
      const read = attachmentReads.claim({ key });
      try {
        const attachments = await listGoalAttachmentsForSession(tauriDatabase, sessionId);
        if (read.isCurrent()) {
          set((state) => ({
            sessionAttachments: { ...state.sessionAttachments, [sessionId]: attachments },
          }));
        }
      } catch (error) {
        if (read.isCurrent()) {
          throw error;
        }
      }
      return;
    }
    const runId = owner.id as WorkflowRunId;
    if (get().workflowRunAttachments[runId] !== undefined) {
      return;
    }
    const read = attachmentReads.claim({ key });
    try {
      const attachments = await listGoalAttachmentsForRun(tauriDatabase, runId);
      if (read.isCurrent()) {
        set((state) => ({
          workflowRunAttachments: { ...state.workflowRunAttachments, [runId]: attachments },
        }));
      }
    } catch (error) {
      if (read.isCurrent()) {
        throw error;
      }
    }
  };

  return (owner: GoalAttachmentOwner): Promise<void> => {
    const key = attachmentReadKey({ owner });
    const pending = inFlight.get(key);
    if (pending !== undefined) {
      return pending;
    }
    const started = loadOwner({ owner }).finally(() => inFlight.delete(key));
    inFlight.set(key, started);
    return started;
  };
};
