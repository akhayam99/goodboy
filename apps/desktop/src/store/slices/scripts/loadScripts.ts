import type { WorkspaceId } from '@goodboy/types';
import { listWorkspaceScripts } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export function loadScripts(set: SetFn) {
  return async (workspaceId: WorkspaceId) => {
    const scripts = await listWorkspaceScripts(tauriDatabase, workspaceId);
    set((state) => ({
      workspaceScripts: { ...state.workspaceScripts, [workspaceId]: scripts },
    }));
  };
}
