import type { WorkspaceId, WorkspaceScriptId } from '@goodboy/types';
import { deleteWorkspaceScript } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export function deleteScript(set: SetFn) {
  return async (scriptId: WorkspaceScriptId, workspaceId: WorkspaceId) => {
    await deleteWorkspaceScript(tauriDatabase, scriptId);
    set((state) => ({
      workspaceScripts: {
        ...state.workspaceScripts,
        [workspaceId]: (state.workspaceScripts[workspaceId] ?? []).filter((s) => s.id !== scriptId),
      },
    }));
  };
}
