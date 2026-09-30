import type { ProjectId } from '@goodboy/types';
import { checkoutFastForward } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from './types';
import { projectById } from './projectIndex';

type Input = {
  readonly projectId: ProjectId;
};

export const fastForwardProjectCheckout = (set: SetFn, get: GetFn) => {
  return async ({ projectId }: Input): Promise<void> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined || project.kind !== 'repo') {
      return;
    }
    set((state) => ({
      projectCheckoutPulling: { ...state.projectCheckoutPulling, [projectId]: true },
    }));
    try {
      await checkoutFastForward({
        checkoutPath: project.rootPath,
        workspaceId: project.workspaceId,
        projectId: project.id,
      });
      await get().loadProjectGitStatus({ projectId });
    } finally {
      set((state) => ({
        projectCheckoutPulling: { ...state.projectCheckoutPulling, [projectId]: false },
      }));
    }
  };
};
