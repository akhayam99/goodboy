import type { SliceDeps } from '../../slice-types';
import { abortRebaseAll } from './abortRebaseAll';
import { dismissRebaseAll } from './dismissRebaseAll';
import { dismissRebaseCard } from './dismissRebaseCard';
import { rebaseAll } from './rebaseAll';
import { resolveRebaseWithAuto } from './resolveRebaseWithAuto';
import { settleStaleRebases } from './settleStaleRebases';
import { updateAll } from './updateAll';

export const createRebaseAllSlice = ({ set, get }: SliceDeps) => {
  return {
    rebaseAll: rebaseAll(set, get),
    abortRebaseAll: abortRebaseAll(set),
    dismissRebaseAll: dismissRebaseAll(set),
    dismissRebaseCard: dismissRebaseCard({ set, get }),
    resolveRebaseWithAuto: resolveRebaseWithAuto(set, get),
    settleStaleRebases: settleStaleRebases(set, get),
    updateAll: updateAll(get),
  };
};
