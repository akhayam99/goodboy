import { applySessionDecisionOps } from './applySessionDecisionOps';
import { consolidateSessionContext } from './consolidateSessionContext';
import { loadSessionDecisions } from './loadSessionDecisions';
import { noteDecisionChanges } from './noteDecisionChanges';
import type { GetFn, SetFn } from './types';

export const createDecisionsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadSessionDecisions: loadSessionDecisions(set, get),
    applySessionDecisionOps: applySessionDecisionOps(set, get),
    noteDecisionChanges: noteDecisionChanges(get),
    consolidateSessionContext: consolidateSessionContext(set, get),
  };
};
