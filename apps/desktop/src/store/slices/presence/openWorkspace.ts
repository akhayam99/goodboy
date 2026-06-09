import type { WorkspaceId } from '@goodboy/types';
import {
  currentWindowLabel,
  focusWindow,
  spawnWorkspaceWindow,
} from '../../../features/workspace/window';
import type { GetFn } from './types';

export const openWorkspace = (get: GetFn) => {
  return async (id: WorkspaceId, title: string): Promise<void> => {
    const presence = get().windowPresence;
    const myLabel = currentWindowLabel();
    const shownLabel = Object.entries(presence).find(([, ws]) => ws === id)?.[0] ?? null;

    if (shownLabel === myLabel) return;
    if (shownLabel) {
      if (await focusWindow(shownLabel)) return;
    }
    if (get().currentWorkspaceId === null) {
      await get().setCurrentWorkspace(id);
      return;
    }
    await spawnWorkspaceWindow(id, title);
  };
};
