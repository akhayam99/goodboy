import type { IsoDateTime, WorkspaceId } from '@goodboy/types';
import { listSessionsForWorkspace } from '@goodboy/db';
import { listLiveRunIds } from '../../../features/chat/turn';
import { tauriDatabase } from '../../../shared/lib/db';
import { reconcileLoadedSessions } from '../sessions/reconcileSessionRuns';
import type { SetFn } from './types';

export const refreshSessions = (set: SetFn) => {
  return async (workspaceId: WorkspaceId) => {
    const loadedSessions = await listSessionsForWorkspace(tauriDatabase, workspaceId);
    const liveRunIds = await listLiveRunIds();
    const now = new Date().toISOString() as IsoDateTime;
    const sessions = await reconcileLoadedSessions({ sessions: loadedSessions, liveRunIds, now });
    set({ sessions });
  };
};
