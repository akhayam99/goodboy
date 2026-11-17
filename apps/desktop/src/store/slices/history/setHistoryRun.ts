import type { MountId, SessionId } from '@goodboy/types';
import { settledStopsOfMount } from '../rebaseAll/settledStopsOfMount';
import { writeSettledStops } from '../rebaseAll/writeSettledStops';
import type { SettledStops } from '../rebaseAll/settledStopsMemory';
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
  movedHead: null,
  threadShas: [],
  commitCount: null,
} satisfies Omit<HistoryRun, 'sessionId' | 'mountId' | 'origin' | 'updatedAt'>;

type Outcome = {
  settled: SettledStops | null;
};

export const setHistoryRun = ({ set, sessionId, mountId, origin, patch }: Params): void => {
  const isCompleted =
    origin === 'rebase' && (patch.phase === 'applied' || patch.phase === 'pushed');
  const outcome: Outcome = { settled: null };
  set((state) => {
    const current = state.historyRuns[mountId];
    const base = current === undefined || current.sessionId !== sessionId ? EMPTY_RUN : current;
    const settled = isCompleted
      ? settledStopsOfMount({
          settled: state.settledRebaseStops,
          events: state.sessionEvents?.[sessionId],
          sessionId,
          mountId,
        })
      : null;
    outcome.settled = settled;
    return {
      ...(settled !== null && { settledRebaseStops: settled }),
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
  if (outcome.settled !== null) {
    writeSettledStops({ stops: outcome.settled });
  }
};
