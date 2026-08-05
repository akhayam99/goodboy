import { refreshSessionBitbucketPr } from './refreshSessionBitbucketPr';
import { selectSessionBitbucketPr } from './selectSessionBitbucketPr';
import type { GetFn, SetFn } from './types';

export { initialBitbucketPrState } from './state';
export type { BitbucketPrSliceState, SessionBitbucketPrEntry } from './state';
export type { RefreshSessionBitbucketPrOptions } from './refreshSessionBitbucketPr';

export const createBitbucketPrSlice = (set: SetFn, get: GetFn) => ({
  refreshSessionBitbucketPr: refreshSessionBitbucketPr(set, get),
  selectSessionBitbucketPr: selectSessionBitbucketPr(set, get),
});
