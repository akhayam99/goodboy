import { applySessionDecisionOps } from './applySessionDecisionOps';
import { consolidateSessionContext } from './consolidateSessionContext';
import { loadSessionDecisions } from './loadSessionDecisions';
import { noteDecisionChanges } from './noteDecisionChanges';
import type { SliceDeps } from '../../slice-types';

export const createDecisionsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadSessionDecisions: loadSessionDecisions(set, get),
    applySessionDecisionOps: applySessionDecisionOps(set, get),
    noteDecisionChanges: noteDecisionChanges(get),
    consolidateSessionContext: consolidateSessionContext(set, get),
  };
};
