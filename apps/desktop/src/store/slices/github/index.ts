import { clearGithubToken } from './clearGithubToken';
import { closePr } from './closePr';
import { convertPrToDraft } from './convertPrToDraft';
import { createPrForSession } from './createPrForSession';
import { editPr } from './editPr';
import { markPrReady } from './markPrReady';
import { mergePr } from './mergePr';
import { reopenPr } from './reopenPr';
import { requestReview } from './requestReview';
import { refreshGithubStatus } from './refreshGithubStatus';
import { refreshSessionPr } from './refreshSessionPr';
import { refreshSessionPrDetail } from './refreshSessionPrDetail';
import { resolveGithubThread } from './resolveGithubThread';
import { queueResolution } from './queueResolution';
import { dequeueResolution } from './dequeueResolution';
import { loadPendingResolutions } from './loadPendingResolutions';
import { pushAllResolutions } from './pushAllResolutions';
import { setGithubPat } from './setGithubPat';
import { sweepGithub } from './sweepGithub';
import type { GetFn, SetFn } from './types';

export const createGithubSlice = (set: SetFn, get: GetFn) => {
  return {
    refreshGithubStatus: refreshGithubStatus(set),
    setGithubPat: setGithubPat(set),
    clearGithubToken: clearGithubToken(set, get),
    refreshSessionPr: refreshSessionPr(set, get),
    refreshSessionPrDetail: refreshSessionPrDetail(set, get),
    resolveGithubThread: resolveGithubThread(set, get),
    queueResolution: queueResolution(set, get),
    dequeueResolution: dequeueResolution(set, get),
    loadPendingResolutions: loadPendingResolutions(set, get),
    pushAllResolutions: pushAllResolutions(set, get),
    createPrForSession: createPrForSession(set, get),
    markPrReady: markPrReady(set, get),
    convertPrToDraft: convertPrToDraft(set, get),
    mergePr: mergePr(set, get),
    closePr: closePr(set, get),
    reopenPr: reopenPr(set, get),
    editPr: editPr(set, get),
    requestReview: requestReview(set, get),
    sweepGithub: sweepGithub(set, get),
  };
};
