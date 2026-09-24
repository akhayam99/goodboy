import { runWithLimit } from '../../../shared/utils/runWithLimit';
import { listSessionPrFetches } from './resolveSessionPrFetch';
import type { GetFn, SetFn } from './types';

type Params = { skipUnknownPr?: boolean };

export const REVIEW_REFRESH_CONCURRENCY = 4;

export const sweepGithub = (set: SetFn, get: GetFn) => {
  return (opts?: Params) => {
    if (!get().githubStatus?.available) {
      set({ boardReady: true });
      return;
    }
    const wsAtStart = get().currentWorkspaceId;
    const { sessions, currentSessionId } = get();
    const subOpts = { silent: true, retries: 1 } as const;
    const tasks: Array<() => Promise<void>> = [];
    for (const session of sessions) {
      for (const target of listSessionPrFetches({ state: get(), sessionId: session.id })) {
        const mountId = target.mount.id;
        const cached = get().mountGithub?.[mountId];
        const pr = cached?.pr ?? null;
        if (pr !== null && (pr.state === 'merged' || pr.state === 'closed')) {
          continue;
        }
        if (opts?.skipUnknownPr === true && cached?.fetchedAt != null && pr === null) {
          continue;
        }
        tasks.push(async () => {
          await get().refreshSessionPr(session.id, { ...subOpts, mountId });
          if (session.id === currentSessionId) {
            void get().refreshSessionPrDetail(session.id, { ...subOpts, mountId });
          }
        });
      }
    }
    if (tasks.length > 0) {
      void runWithLimit({ tasks, limit: REVIEW_REFRESH_CONCURRENCY }).then(() => {
        if (get().currentWorkspaceId === wsAtStart) {
          set({ boardReady: true });
        }
      });
    }
  };
};
