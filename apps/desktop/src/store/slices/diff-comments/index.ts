import { addDiffComment } from './addDiffComment';
import { closeDiffNoteLaunch, showDiffNoteLaunch } from './diffNoteLaunch';
import { deleteDiffComment } from './deleteDiffComment';
import { loadDiffComments } from './loadDiffComments';
import { reopenDiffComment } from './reopenDiffComment';
import type { SliceDeps } from '../../slice-types';

export const createDiffCommentsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadDiffComments: loadDiffComments(set, get),
    addDiffComment: addDiffComment(set, get),
    reopenDiffComment: reopenDiffComment(set, get),
    deleteDiffComment: deleteDiffComment(set, get),
    showDiffNoteLaunch: showDiffNoteLaunch({ set }),
    closeDiffNoteLaunch: closeDiffNoteLaunch({ set }),
  };
};
