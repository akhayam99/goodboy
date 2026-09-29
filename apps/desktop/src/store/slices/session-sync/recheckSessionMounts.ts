import { refreshWorktreeStatuses } from '../../../features/session/hooks/useWorktreeStatuses/cache';
import { listSessionPrFetches } from '../github/resolveSessionPrFetch';
import type { GetFn, RecheckReason, RecheckSessionMountsParams } from './types';

const RECHECK_MIN_AGE_MS: Readonly<Record<RecheckReason, number>> = {
  'turn-end': 5_000,
  focus: 60_000,
};

export const recheckSessionMounts = (get: GetFn) => {
  return async ({ sessionId, reason }: RecheckSessionMountsParams): Promise<void> => {
    const state = get();
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    if (session === undefined || session.archivedAt != null) {
      return;
    }
    const localRefresh = refreshWorktreeStatuses({
      worktreePaths: listSessionPrFetches({ state, sessionId }).map(({ cwd }) => cwd),
    });
    if (state.githubStatus?.available !== true) {
      await localRefresh;
      return;
    }
    const now = Date.now();
    const minAgeMs = RECHECK_MIN_AGE_MS[reason];
    const mountIds = listSessionPrFetches({ state, sessionId }).flatMap(({ mount }) => {
      const entry = state.mountGithub?.[mount.id];
      if (entry?.loading === true) {
        return [];
      }
      if (entry?.pr?.state === 'merged' || entry?.pr?.state === 'closed') {
        return [];
      }
      const fetchedAt = entry?.fetchedAt == null ? null : Date.parse(entry.fetchedAt);
      if (fetchedAt !== null && now - fetchedAt < minAgeMs) {
        return [];
      }
      return [mount.id];
    });
    await Promise.all([
      localRefresh,
      ...mountIds.map((mountId) => get().refreshSessionPr(sessionId, { mountId, silent: true })),
    ]);
  };
};
