import { listActiveResolveAttempts } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { drainResolveQueue } from './drainResolveQueue';
import type { SliceParams, WorktreeDrainParams } from './types';

type Params = SliceParams & WorktreeDrainParams;

export const drainResolveWorktree = async ({ set, get, worktreePath }: Params): Promise<void> => {
  const active = await listActiveResolveAttempts({ db: tauriDatabase });
  const sessionIds = new Set<SessionId>(
    active
      .filter((attempt) => attempt.mountTarget?.worktreePath === worktreePath)
      .map((attempt) => attempt.sessionId),
  );
  for (const sessionId of sessionIds) {
    await drainResolveQueue({ set, get, sessionId });
  }
};
