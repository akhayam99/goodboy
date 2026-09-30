import { addGoalAttachments } from './addGoalAttachments';
import { loadGoalAttachments } from './loadGoalAttachments';
import { removeGoalAttachment } from './removeGoalAttachment';
import type { SliceDeps } from '../../slice-types';

export const createAttachmentsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadGoalAttachments: loadGoalAttachments(set, get),
    addGoalAttachments: addGoalAttachments(set, get),
    removeGoalAttachment: removeGoalAttachment(set, get),
  };
};
