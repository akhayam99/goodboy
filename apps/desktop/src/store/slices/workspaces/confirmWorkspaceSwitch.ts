import type { GetFn, SetFn } from './types';

export function confirmWorkspaceSwitch(set: SetFn, get: GetFn) {
  return async (): Promise<void> => {
    const pending = get().pendingWorkspaceSwitch;
    if (!pending) return;
    set({ pendingWorkspaceSwitch: null });
    await get().setCurrentWorkspace(pending.targetId);
  };
}
