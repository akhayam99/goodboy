import { cancelCurrentTurn } from './cancelCurrentTurn';
import { retrySummarizer } from './retrySummarizer';
import { sendTurn } from './sendTurn';
import type { GetFn, SetFn } from './types';

export const createTurnSlice = (set: SetFn, get: GetFn) => {
  return {
    sendTurn: sendTurn(set, get),
    cancelCurrentTurn: cancelCurrentTurn(set, get),
    retrySummarizer: retrySummarizer(set, get),
  };
};
