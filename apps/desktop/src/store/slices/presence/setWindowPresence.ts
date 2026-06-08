import type { WorkspaceId } from '@goodboy/types';
import type { SetFn } from './types';

export function setWindowPresence(set: SetFn) {
  return (label: string, workspaceId: WorkspaceId | null): void => {
    set((state) => ({
      windowPresence: { ...state.windowPresence, [label]: workspaceId },
    }));
  };
}
