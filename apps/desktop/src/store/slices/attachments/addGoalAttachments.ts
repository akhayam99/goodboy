import type { AttachmentInput, GoalAttachmentOwner } from '@goodboy/types';
import { attachmentReadKey } from './attachmentReadKey';
import { attachmentWrites } from './attachmentWrites';
import { saveGoalAttachments } from './saveGoalAttachments';
import { sessionIdOfOwner } from './sessionIdOfOwner';
import type { GetFn, SetFn } from './types';

export const addGoalAttachments = (set: SetFn, get: GetFn) => {
  return async (
    owner: GoalAttachmentOwner,
    inputs: ReadonlyArray<AttachmentInput>,
  ): Promise<void> => {
    if (inputs.length === 0) {
      return;
    }
    const sessionId = sessionIdOfOwner({ get, owner });
    if (sessionId === null) {
      throw new Error('cannot add goal attachments: session not found');
    }
    await attachmentWrites.run({
      key: attachmentReadKey({ owner }),
      task: () => saveGoalAttachments({ set, get, sessionId, owner, inputs }),
    });
  };
};
