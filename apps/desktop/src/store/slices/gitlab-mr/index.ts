import { createMrForSession } from './createMrForSession';
import { mergeMrForSession } from './mergeMrForSession';
import { refreshSessionMr } from './refreshSessionMr';
import type { GetFn, SetFn } from './types';

export const createGitlabMrSlice = (set: SetFn, get: GetFn) => {
  return {
    refreshSessionMr: refreshSessionMr(set, get),
    createMrForSession: createMrForSession(set, get),
    mergeMrForSession: mergeMrForSession(set, get),
  };
};
