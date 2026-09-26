import { applyHistoryRewrite, pushHistoryRewrite } from './applyHistoryRewrite';
import { rebaseBranch } from './rebaseBranch';
import { settleHistoryRewriter } from './settleHistoryRewriter';
import { startHistoryRewriter } from './startHistoryRewriter';
import type { GetFn, SetFn } from './types';

export { historyInitialState } from './state';

export const createHistorySlice = (set: SetFn, get: GetFn) => {
  return {
    rebaseBranch: rebaseBranch(set, get),
    applyHistoryRewrite: applyHistoryRewrite(set, get),
    pushHistoryRewrite: pushHistoryRewrite(set, get),
    startHistoryRewriter: startHistoryRewriter(set, get),
    settleHistoryRewriter: settleHistoryRewriter(set, get),
  };
};
