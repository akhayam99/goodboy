import { approveBitbucketPr } from './approveBitbucketPr';
import { commentOnBitbucketPr } from './commentOnBitbucketPr';
import { createMrForSession } from './createMrForSession';
import { declineBitbucketPr } from './declineBitbucketPr';
import { mergeBitbucketPr } from './mergeBitbucketPr';
import { mergeMrForSession } from './mergeMrForSession';
import { refreshSessionBitbucketPr } from './refreshSessionBitbucketPr';
import { refreshSessionMr } from './refreshSessionMr';
import { replyToBitbucketPrComment } from './replyToBitbucketPrComment';
import { requestBitbucketPrChanges } from './requestBitbucketPrChanges';
import { selectSessionBitbucketPr } from './selectSessionBitbucketPr';
import { unapproveBitbucketPr } from './unapproveBitbucketPr';
import { withdrawBitbucketPrChanges } from './withdrawBitbucketPrChanges';
import type { SliceDeps } from '../../slice-types';

export type { BitbucketPrWriteParams } from './types';

export const createMountRequestSlice = ({ set, get }: SliceDeps) => ({
  refreshSessionMr: refreshSessionMr(set, get),
  createMrForSession: createMrForSession(set, get),
  mergeMrForSession: mergeMrForSession(set, get),
  refreshSessionBitbucketPr: refreshSessionBitbucketPr(set, get),
  selectSessionBitbucketPr: selectSessionBitbucketPr(set, get),
  approveBitbucketPr: approveBitbucketPr(set, get),
  unapproveBitbucketPr: unapproveBitbucketPr(set, get),
  requestBitbucketPrChanges: requestBitbucketPrChanges(set, get),
  withdrawBitbucketPrChanges: withdrawBitbucketPrChanges(set, get),
  mergeBitbucketPr: mergeBitbucketPr(set, get),
  declineBitbucketPr: declineBitbucketPr(set, get),
  commentOnBitbucketPr: commentOnBitbucketPr(set, get),
  replyToBitbucketPrComment: replyToBitbucketPrComment(set, get),
});
