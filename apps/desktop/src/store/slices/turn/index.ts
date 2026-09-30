import { cancelCurrentTurn } from './cancelCurrentTurn';
import { continueStoppedAgent } from './continueStoppedAgent';
import { retrySummarizer } from './retrySummarizer';
import { sendTurn } from './sendTurn';
import type { SliceDeps } from '../../slice-types';

export const createTurnSlice = ({ set, get }: SliceDeps) => {
  return {
    sendTurn: sendTurn(set, get),
    cancelCurrentTurn: cancelCurrentTurn(set, get),
    continueStoppedAgent: continueStoppedAgent(get),
    retrySummarizer: retrySummarizer(set, get),
  };
};
