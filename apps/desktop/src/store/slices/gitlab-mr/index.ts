import { createMrForSession } from './createMrForSession';
import { mergeMrForSession } from './mergeMrForSession';
import { refreshSessionMr } from './refreshSessionMr';
import type { SliceDeps } from '../../slice-types';

export { initialGitlabMrState } from './state';

export const createGitlabMrSlice = ({ set, get }: SliceDeps) => {
  return {
    refreshSessionMr: refreshSessionMr(set, get),
    createMrForSession: createMrForSession(set, get),
    mergeMrForSession: mergeMrForSession(set, get),
  };
};
