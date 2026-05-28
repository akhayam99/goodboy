import { clearGithubToken } from './clearGithubToken';
import { createPrForSession } from './createPrForSession';
import { refreshGithubStatus } from './refreshGithubStatus';
import { refreshSessionPr } from './refreshSessionPr';
import { refreshSessionPrDetail } from './refreshSessionPrDetail';
import { resolveGithubThread } from './resolveGithubThread';
import { setGithubPat } from './setGithubPat';
import { sweepGithub } from './sweepGithub';
import type { GetFn, SetFn } from './types';

export function createGithubSlice(set: SetFn, get: GetFn) {
  return {
    refreshGithubStatus: refreshGithubStatus(set),
    setGithubPat: setGithubPat(set),
    clearGithubToken: clearGithubToken(set, get),
    refreshSessionPr: refreshSessionPr(set, get),
    refreshSessionPrDetail: refreshSessionPrDetail(set, get),
    resolveGithubThread: resolveGithubThread(set, get),
    createPrForSession: createPrForSession(set, get),
    sweepGithub: sweepGithub(set, get),
  };
}
