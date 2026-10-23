import { insertSessionEvent } from '@goodboy/db';
import { brandId, type IsoDateTime, type SessionEvent, type SessionEventId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SliceDeps } from '../../slice-types';
import { mergeSessionEvents } from '../session-events/types';
import { historyTargetOf } from './historyTargetOf';
import type { HistoryMountInput } from './types';

export const keepRebaseStop =
  ({ set, get }: SliceDeps) =>
  async ({ sessionId, mountId }: HistoryMountInput): Promise<void> => {
    const target = historyTargetOf({ get, sessionId, mountId });
    const run = get().historyRuns[mountId];
    const event: SessionEvent = {
      id: brandId<SessionEventId>({ value: crypto.randomUUID() }),
      sessionId,
      kind: 'history_restored',
      payload: {
        mountId,
        projectId: target.projectId,
        projectName: target.projectName,
        worktreePath: target.worktreePath,
        branch: target.branch,
        origin: 'rebase',
        reason: 'kept',
      },
      createdAt: brandId<IsoDateTime>({ value: new Date().toISOString() }),
    };
    await insertSessionEvent({ db: tauriDatabase, event });
    set((state) => {
      const existing = state.sessionEvents?.[sessionId];
      const current = state.historyRuns[mountId];
      const isSameRun = current !== undefined && current === run;
      const { [mountId]: _kept, ...rest } = state.historyRuns;
      return {
        ...(existing !== undefined && {
          sessionEvents: {
            ...state.sessionEvents,
            [sessionId]: mergeSessionEvents({ existing, next: event }),
          },
        }),
        ...(isSameRun && { historyRuns: rest }),
      };
    });
  };
