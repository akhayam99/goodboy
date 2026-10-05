import { addDiffComment } from './addDiffComment';
import { assignDiffComment } from './assignDiffComment';
import { deleteDiffComment } from './deleteDiffComment';
import { loadDiffComments } from './loadDiffComments';
import { reopenDiffComment } from './reopenDiffComment';
import type { SliceDeps } from '../../slice-types';

export const createDiffCommentsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadDiffComments: loadDiffComments(set, get),
    addDiffComment: addDiffComment(set, get),
    assignDiffComment: assignDiffComment(set, get),
    reopenDiffComment: reopenDiffComment(set, get),
    deleteDiffComment: deleteDiffComment(set, get),
  };
};
