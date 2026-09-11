import { listWorktreesForSession } from '@goodboy/db';
import type { MountTargetSnapshot, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { resolveWorktreeMount } from './resolveWorktreeMount';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly target: MountTargetSnapshot | null;
};

const isSessionLoaded = ({ get, sessionId }: Omit<Params, 'target'>): boolean => {
  const state = get();
  return (
    state.sessionMounts?.[sessionId] !== undefined ||
    state.sessionProjectMounts?.[sessionId] !== undefined
  );
};

export const resolveWorktreePath = async ({
  get,
  sessionId,
  target,
}: Params): Promise<string | null> => {
  if (target === null) {
    return null;
  }
  if (isSessionLoaded({ get, sessionId })) {
    return resolveWorktreeMount({ get, sessionId, target });
  }
  const rows = await listWorktreesForSession(tauriDatabase, sessionId).catch(() => []);
  const row = rows.find((candidate) => candidate.id === target.mountId);
  return row?.worktreePath === target.worktreePath ? target.worktreePath : null;
};
