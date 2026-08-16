import type { WorkspaceId } from '@goodboy/types';
import { checkoutFastForward } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from './types';

type Input = {
  workspaceId: WorkspaceId;
};

export const fastForwardWorkspaceCheckout = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId }: Input): Promise<void> => {
    const workspace = get().workspaces.find((candidate) => candidate.id === workspaceId);
    if (workspace == null || workspace.kind !== 'repo') {
      return;
    }
    set((state) => ({
      workspaceCheckoutPulling: { ...state.workspaceCheckoutPulling, [workspaceId]: true },
    }));
    try {
      await checkoutFastForward({ checkoutPath: workspace.rootPath });
      await get().loadWorkspaceGitStatus({ workspaceId });
    } finally {
      set((state) => ({
        workspaceCheckoutPulling: { ...state.workspaceCheckoutPulling, [workspaceId]: false },
      }));
    }
  };
};
