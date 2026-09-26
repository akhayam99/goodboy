import type { WorkspaceId } from '@goodboy/types';
import { findMovedProjects as findCandidates } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from '../../slice-types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly parent: string;
};

export const findMovedProjects = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, parent }: Params): Promise<void> => {
    const projects = get().projects.filter(
      (project) =>
        project.workspaceId === workspaceId &&
        project.kind === 'repo' &&
        get().projectGitStatus[project.id]?.state === 'missing',
    );
    const matches = await findCandidates({
      parent,
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        ...(project.rootCommit === undefined ? {} : { rootCommit: project.rootCommit }),
        ...(project.remoteUrl === undefined ? {} : { remoteUrl: project.remoteUrl }),
      })),
    });
    set({
      projectRelocationWorkspaceId: workspaceId,
      projectRelocationCandidates: projects.map((project) => {
        const match = matches.find((candidate) => candidate.projectId === project.id);
        return {
          projectId: project.id,
          name: project.name,
          fromRoot: project.rootPath,
          toRoot: match?.path ?? null,
          verdict: match?.verdict ?? 'not_found',
          identity: match?.identity ?? null,
          isSelected: match?.verdict === 'same_repository',
          status: 'ready',
        };
      }),
      projectRelocationCompleted: [],
      projectRelocationPhase: 'preview',
      projectRelocationError: null,
    });
  };
};
