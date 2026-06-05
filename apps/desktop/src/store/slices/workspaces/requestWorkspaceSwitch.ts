import type { WorkspaceId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

export function requestWorkspaceSwitch(set: SetFn, get: GetFn) {
  return async (id: WorkspaceId | null): Promise<void> => {
    if (id === get().currentWorkspaceId) {
      await get().setCurrentWorkspace(id);
      return;
    }
    const hasRunning = get().sessions.some((s) => s.state.kind === 'running');
    if (!hasRunning) {
      await get().setCurrentWorkspace(id);
      return;
    }
    set({ pendingWorkspaceSwitch: { targetId: id } });
  };
}
