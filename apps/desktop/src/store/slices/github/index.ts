import { clearGithubToken } from './clearGithubToken';
import { closePr } from './closePr';
import { convertPrToDraft } from './convertPrToDraft';
import { createPrForSession } from './createPrForSession';
import { markPrReady } from './markPrReady';
import { mergePr } from './mergePr';
import { reopenPr } from './reopenPr';
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
    markPrReady: markPrReady(set, get),
    convertPrToDraft: convertPrToDraft(set, get),
    mergePr: mergePr(set, get),
    closePr: closePr(set, get),
    reopenPr: reopenPr(set, get),
    sweepGithub: sweepGithub(set, get),
  };
}
