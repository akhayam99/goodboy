import { addDiffComment } from './addDiffComment';
import { deleteDiffComment } from './deleteDiffComment';
import { loadDiffComments } from './loadDiffComments';
import { reopenDiffComment } from './reopenDiffComment';
import { resolveDiffComment } from './resolveDiffComment';
import type { GetFn, SetFn } from './types';

export const createDiffCommentsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadDiffComments: loadDiffComments(set, get),
    addDiffComment: addDiffComment(set, get),
    resolveDiffComment: resolveDiffComment(set, get),
    reopenDiffComment: reopenDiffComment(set, get),
    deleteDiffComment: deleteDiffComment(set, get),
  };
};
