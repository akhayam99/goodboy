import { loadDecisionLedger } from '@goodboy/core';
import { listContextSlotsForSession } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { withDecisionsSlot } from './withDecisionsSlot';
import type { SetFn } from './types';

export const loadSessionDecisions = (set: SetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    const ledger = await loadDecisionLedger({ db: tauriDatabase, sessionId });
    const slots = await listContextSlotsForSession(tauriDatabase, sessionId);
    set((state) => ({
      sessionDecisions: { ...state.sessionDecisions, [sessionId]: ledger },
      sessionSlots: withDecisionsSlot({ state, sessionId, slots }),
    }));
  };
};
