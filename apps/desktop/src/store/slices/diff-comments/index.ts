import { addDiffComment } from './addDiffComment';
import { consumeDiffComments } from './consumeDiffComments';
import { deleteDiffComment } from './deleteDiffComment';
import { loadDiffComments } from './loadDiffComments';
import { reopenDiffComment } from './reopenDiffComment';
import { resolveDiffComment } from './resolveDiffComment';
import type { GetFn, SetFn } from './types';

export const createDiffCommentsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadDiffComments: loadDiffComments(set, get),
    addDiffComment: addDiffComment(set),
    resolveDiffComment: resolveDiffComment(set),
    consumeDiffComments: consumeDiffComments(set),
    reopenDiffComment: reopenDiffComment(set),
    deleteDiffComment: deleteDiffComment(set),
  };
};
