import type { AttachmentInput, GoalAttachmentOwner, SessionId } from '@goodboy/types';
import { saveGoalAttachments } from './saveGoalAttachments';
import type { GetFn, SetFn } from './types';

export const addGoalAttachments = (set: SetFn, get: GetFn) => {
  return async (
    owner: GoalAttachmentOwner,
    inputs: ReadonlyArray<AttachmentInput>,
  ): Promise<void> => {
    if (inputs.length === 0) {
      return;
    }
    const sessionId = owner.type === 'session' ? (owner.id as SessionId) : get().currentSessionId;
    if (sessionId == null) {
      throw new Error('cannot add goal attachments: session worktree not available');
    }
    const worktreeDir = (get().sessionWorktrees[sessionId] ?? [])[0];
    if (worktreeDir === undefined) {
      throw new Error('cannot add goal attachments: session worktree not available');
    }
    await saveGoalAttachments({ set, worktreeDir, owner, inputs });
  };
};
