import { updateProjectIdentity } from '@goodboy/db';
import type { IsoDateTime } from '@goodboy/types';
import { projectRelocate } from '../../../features/workspace/projectRelocation';
import { tauriDatabase } from '../../../shared/lib/db';
import { repoIdentity } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from '../../slice-types';
import type { CompletedProjectRelocation } from './state';

export const relocateProjects = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    const selected = get().projectRelocationCandidates.filter(
      (candidate) => candidate.isSelected && candidate.toRoot !== null,
    );
    if (selected.length === 0) {
      return;
    }
    set({ projectRelocationPhase: 'moving', projectRelocationError: null });
    const completed: Array<CompletedProjectRelocation> = [];
    try {
      for (const candidate of selected) {
        set((state) => ({
          projectRelocationCandidates: state.projectRelocationCandidates.map((entry) =>
            entry.projectId === candidate.projectId ? { ...entry, status: 'updating' } : entry,
          ),
        }));
        const toRoot = candidate.toRoot;
        if (toRoot === null) {
          continue;
        }
        const relocationId = crypto.randomUUID();
        const result = await projectRelocate({
          relocationId,
          projectId: candidate.projectId,
          fromRoot: candidate.fromRoot,
          toRoot,
        });
        const identity = candidate.identity ?? (await repoIdentity({ path: toRoot }));
        const checkedAt = new Date().toISOString() as IsoDateTime;
        const rootCommit = identity.rootCommits[0] ?? null;
        await updateProjectIdentity({
          db: tauriDatabase,
          projectId: candidate.projectId,
          rootCommit,
          remoteUrl: identity.remoteUrl,
          checkedAt,
        });
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === candidate.projectId
              ? {
                  ...project,
                  rootPath: toRoot,
                  ...(rootCommit === null ? {} : { rootCommit }),
                  ...(identity.remoteUrl === null ? {} : { remoteUrl: identity.remoteUrl }),
                  identityCheckedAt: checkedAt,
                  updatedAt: checkedAt,
                }
              : project,
          ),
          projectGitStatus: {
            ...state.projectGitStatus,
            [candidate.projectId]: {
              state: 'ready',
              branch: null,
              headSubject: null,
              upstreamDistance: { kind: 'unknown', reason: 'rev-list-failed' },
              workingTree: { kind: 'unknown', reason: 'status-read-failed' },
              upstream: null,
              inProgress: null,
            },
          },
          projectRelocationCandidates: state.projectRelocationCandidates.map((entry) =>
            entry.projectId === candidate.projectId ? { ...entry, status: 'done' } : entry,
          ),
        }));
        completed.push({
          relocationId,
          projectId: candidate.projectId,
          fromRoot: candidate.fromRoot,
          toRoot,
          restoredSessionFolders: result.restoredSessionFolders,
          repairedGitLinks: result.repairedGitLinks,
        });
      }
      set({ projectRelocationCompleted: completed, projectRelocationPhase: 'success' });
    } catch (error: unknown) {
      set({
        projectRelocationCompleted: completed,
        projectRelocationPhase: 'error',
        projectRelocationError: error instanceof Error ? error.message : String(error),
      });
    }
  };
};
