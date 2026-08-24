import type { WorkspaceId, ProjectScriptId } from '@goodboy/types';
import { deleteProjectScript } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const deleteScript = (set: SetFn) => {
  return async (scriptId: ProjectScriptId, workspaceId: WorkspaceId) => {
    await deleteProjectScript({ db: tauriDatabase, scriptId });
    set((state) => ({
      projectScripts: {
        ...state.projectScripts,
        [workspaceId]: (state.projectScripts[workspaceId] ?? []).filter((s) => s.id !== scriptId),
      },
    }));
  };
};
