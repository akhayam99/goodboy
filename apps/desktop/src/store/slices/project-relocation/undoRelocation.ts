import { updateProjectIdentity } from '@goodboy/db';
import type { IsoDateTime } from '@goodboy/types';
import { projectRelocationUndo } from '../../../features/workspace/projectRelocation';
import { tauriDatabase } from '../../../shared/lib/db';
import { repoIdentity } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from '../../slice-types';

export const undoRelocation = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    const completed = [...get().projectRelocationCompleted].reverse();
    if (completed.length === 0) {
      return;
    }
    set({ projectRelocationPhase: 'moving', projectRelocationError: null });
    try {
      for (const relocation of completed) {
        await projectRelocationUndo({ relocationId: relocation.relocationId });
        const identity = await repoIdentity({ path: relocation.fromRoot });
        const checkedAt = new Date().toISOString() as IsoDateTime;
        const rootCommit = identity.rootCommits[0] ?? null;
        await updateProjectIdentity({
          db: tauriDatabase,
          projectId: relocation.projectId,
          rootCommit,
          remoteUrl: identity.remoteUrl,
          checkedAt,
        });
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === relocation.projectId
              ? {
                  ...project,
                  rootPath: relocation.fromRoot,
                  ...(rootCommit === null ? {} : { rootCommit }),
                  ...(identity.remoteUrl === null ? {} : { remoteUrl: identity.remoteUrl }),
                  identityCheckedAt: checkedAt,
                  updatedAt: checkedAt,
                }
              : project,
          ),
        }));
      }
      set({
        projectRelocationCandidates: [],
        projectRelocationCompleted: [],
        projectRelocationPhase: 'idle',
      });
    } catch (error: unknown) {
      set({
        projectRelocationPhase: 'error',
        projectRelocationError: error instanceof Error ? error.message : String(error),
      });
    }
  };
};
