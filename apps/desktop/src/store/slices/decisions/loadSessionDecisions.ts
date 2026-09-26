import { loadDecisionLedger, seedDecisionLedger } from '@goodboy/core';
import { listContextSlotsForSession } from '@goodboy/db';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { withDecisionsSlot } from './withDecisionsSlot';
import type { GetFn, SetFn } from './types';

export const loadSessionDecisions = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    try {
      const ledger = await loadDecisionLedger({ db: tauriDatabase, sessionId });
      const slots = await listContextSlotsForSession(tauriDatabase, sessionId);
      set((state) => ({
        sessionDecisions: { ...state.sessionDecisions, [sessionId]: ledger },
        sessionSlots: withDecisionsSlot({ state, sessionId, slots }),
      }));
    } catch (error) {
      console.warn('[decisions] loading the ledger failed', error);
      if (get().sessionDecisions[sessionId] !== undefined) {
        return;
      }
      const slot = get().sessionSlots[sessionId]?.find(
        (candidate) => candidate.key === 'decisions',
      );
      const ledger = seedDecisionLedger({
        sessionId,
        text: slot?.value ?? '',
        now: new Date().toISOString() as IsoDateTime,
        newId: () => crypto.randomUUID(),
      });
      set((state) => ({ sessionDecisions: { ...state.sessionDecisions, [sessionId]: ledger } }));
    }
  };
};
