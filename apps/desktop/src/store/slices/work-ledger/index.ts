import type { SliceDeps } from '../../slice-types';
import { loadScriptLedger } from './loadScriptLedger';

export const createWorkLedgerSlice = ({ set, get }: SliceDeps) => {
  return {
    loadScriptLedger: loadScriptLedger({ set, get }),
  };
};
