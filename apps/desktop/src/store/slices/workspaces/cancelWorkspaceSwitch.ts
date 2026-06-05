import type { SetFn } from './types';

export function cancelWorkspaceSwitch(set: SetFn) {
  return (): void => {
    set({ pendingWorkspaceSwitch: null });
  };
}
