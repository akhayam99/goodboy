import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { countContextSlotHistoryForSession, listContextSlotsForSession } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { EMPTY_LOADING } from '../../session-mutators';
import type { AppState, SessionLoadingFlags } from '../../types';
import type { SetFn } from './types';

type SettleParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

const withSlotsSettled = ({
  state,
  sessionId,
}: SettleParams): Readonly<Record<string, SessionLoadingFlags>> => {
  const current = state.sessionLoading[sessionId] ?? EMPTY_LOADING;
  return { ...state.sessionLoading, [sessionId]: { ...current, slots: false } };
};

export const loadSessionSlots = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    try {
      const [slots, counts] = await Promise.all([
        listContextSlotsForSession(tauriDatabase, sessionId),
        countContextSlotHistoryForSession(tauriDatabase, sessionId),
      ]);
      set((state) => ({
        sessionSlots: { ...state.sessionSlots, [sessionId]: slots },
        slotHistoryCounts: { ...state.slotHistoryCounts, [sessionId]: counts },
        sessionSlotsLoad: { ...state.sessionSlotsLoad, [sessionId]: 'loaded' },
        sessionLoading: withSlotsSettled({ state, sessionId }),
      }));
    } catch (error) {
      console.error(`[slots] context load failed for session ${sessionId}`, formatError(error));
      set((state) => ({
        sessionSlotsLoad: { ...state.sessionSlotsLoad, [sessionId]: 'failed' },
        sessionLoading: withSlotsSettled({ state, sessionId }),
      }));
    }
  };
};
