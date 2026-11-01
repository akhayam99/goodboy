import { runWithLimit } from '../../../shared/utils/runWithLimit';
import type { SliceDeps } from '../../slice-types';
import type { SweepRequestsParams } from './types';
import { listSessionPrFetches } from '../github/resolveSessionPrFetch';
import { mountFetchFactsOf } from './mountFetchFactsOf';
import { refreshMountRequests } from './refreshMountRequests';
import { refreshMountThreads } from './refreshMountThreads';
import { REVIEW_REFRESH_CONCURRENCY } from './requestRefreshConcurrency';

const SWEEP_OPTIONS = { silent: true, retries: 1 } as const;

const FORCED_OPTIONS = { force: true } as const;

export const sweepRequests = ({ set, get }: SliceDeps) => {
  return ({
    shouldSkipUnknownRequest = false,
    sessionId,
    isForced = false,
  }: SweepRequestsParams = {}): Promise<void> => {
    const workspaceAtStart = get().currentWorkspaceId;
    const { sessions, currentSessionId } = get();
    const baseOptions = isForced ? FORCED_OPTIONS : SWEEP_OPTIONS;
    const tasks: Array<() => Promise<void>> = [];
    for (const session of sessions) {
      if (sessionId !== undefined && session.id !== sessionId) {
        continue;
      }
      for (const target of listSessionPrFetches({ state: get(), sessionId: session.id })) {
        const mountId = target.mount.id;
        const facts = mountFetchFactsOf({
          state: get(),
          workspaceId: session.workspaceId,
          mount: target.mount,
        });
        if (facts.isHostAvailable !== true || (!isForced && facts.isEnded)) {
          continue;
        }
        if (shouldSkipUnknownRequest && facts.fetchedAt !== null && !facts.hasRequest) {
          continue;
        }
        tasks.push(async () => {
          await refreshMountRequests({
            get,
            host: facts.host,
            sessionId: session.id,
            options: { ...baseOptions, mountId },
          });
          if (session.id !== currentSessionId) {
            return;
          }
          await refreshMountThreads({
            set,
            get,
            host: facts.host,
            sessionId: session.id,
            options: { ...baseOptions, mountId },
          });
        });
      }
    }
    if (tasks.length === 0) {
      if (sessionId === undefined) {
        set({ boardReady: true });
      }
      return Promise.resolve();
    }
    return runWithLimit({ tasks, limit: REVIEW_REFRESH_CONCURRENCY }).then(() => {
      if (sessionId === undefined && get().currentWorkspaceId === workspaceAtStart) {
        set({ boardReady: true });
      }
    });
  };
};
