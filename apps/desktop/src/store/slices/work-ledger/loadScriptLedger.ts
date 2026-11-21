import { listScriptLedger, type ScriptLedgerEntry } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../slice-types';
import { sameLedger } from './sameLedger';

type Params = {
  readonly sessionId: SessionId;
};

const NO_ENTRIES: ReadonlyArray<ScriptLedgerEntry> = [];
const LOADS = createLatestOnly();

export const loadScriptLedger = ({ set, get }: SliceDeps) => {
  return async ({ sessionId }: Params): Promise<void> => {
    const claimed = LOADS.claim({ key: sessionId });
    try {
      const entries = await listScriptLedger({ db: tauriDatabase, sessionId });
      if (!claimed.isCurrent()) {
        return;
      }
      if (sameLedger({ before: get().scriptLedger[sessionId] ?? NO_ENTRIES, after: entries })) {
        return;
      }
      set((state) => ({ scriptLedger: { ...state.scriptLedger, [sessionId]: entries } }));
    } catch (error) {
      if (!claimed.isCurrent()) {
        return;
      }
      console.warn(`[work-ledger] script ledger not read for ${sessionId}: ${formatError(error)}`);
    }
  };
};
