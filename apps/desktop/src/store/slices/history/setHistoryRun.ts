import type { MountId, SessionId } from '@goodboy/types';
import type { HistoryRun, HistoryRunOrigin, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly origin: HistoryRunOrigin;
  readonly patch: Partial<Omit<HistoryRun, 'sessionId' | 'mountId' | 'origin' | 'updatedAt'>>;
};

const EMPTY_RUN = {
  phase: 'predicting',
  planId: null,
  agentId: null,
  copyPath: null,
  stop: null,
  result: null,
  backupRef: null,
  remoteSha: null,
  holder: null,
  progress: null,
  applied: null,
  identity: null,
} satisfies Omit<HistoryRun, 'sessionId' | 'mountId' | 'origin' | 'updatedAt'>;

export const setHistoryRun = ({ set, sessionId, mountId, origin, patch }: Params): void => {
  set((state) => {
    const current = state.historyRuns[mountId];
    const base = current === undefined || current.sessionId !== sessionId ? EMPTY_RUN : current;
    return {
      historyRuns: {
        ...state.historyRuns,
        [mountId]: {
          ...base,
          ...patch,
          sessionId,
          mountId,
          origin,
          updatedAt: Date.now(),
        },
      },
    };
  });
};
