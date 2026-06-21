import { addGoalAttachments } from './addGoalAttachments';
import { loadGoalAttachments } from './loadGoalAttachments';
import { removeGoalAttachment } from './removeGoalAttachment';
import type { GetFn, SetFn } from './types';

export const createAttachmentsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadGoalAttachments: loadGoalAttachments(set, get),
    addGoalAttachments: addGoalAttachments(set, get),
    removeGoalAttachment: removeGoalAttachment(set, get),
  };
};
