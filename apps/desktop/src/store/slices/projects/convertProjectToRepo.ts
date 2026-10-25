import type { FirstCommit, IsoDateTime, Project, ProjectId } from '@goodboy/types';
import { updateProjectKind } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { makeFirstCommit } from '../../../shared/lib/folderGit';
import { validateGitRepo } from '../../../shared/lib/repo';
import { acquireWriteSet, releaseWriteSet } from '../../../features/worktree/worktree';
import type { GetFn, SetFn } from './types';
import { projectById } from './projectIndex';
import { writingSessionTitle } from './writingSessionTitle';

type Input = {
  readonly projectId: ProjectId;
  readonly include: ReadonlyArray<string>;
};

export type ConvertedProject = {
  readonly project: Project;
  readonly commit: FirstCommit;
};

type HolderParams = {
  readonly projectId: ProjectId;
};

const trackHolder = ({ projectId }: HolderParams): string => `track-with-git:${projectId}`;

export const convertProjectToRepo = (set: SetFn, get: GetFn) => {
  return async ({ projectId, include }: Input): Promise<ConvertedProject> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    const isUnbornRepo =
      project.kind === 'repo' && get().projectGitStatus[projectId]?.state === 'unborn';
    if (project.kind !== 'folder' && !isUnbornRepo) {
      throw new Error(`${project.name} is already tracked with git`);
    }
    const holder = trackHolder({ projectId });
    const lease = await acquireWriteSet({ paths: [project.rootPath], holder });
    if (!lease.isGranted) {
      const writer = writingSessionTitle({ state: get(), holder: lease.blockedBy });
      throw new Error(
        `${writer ?? 'A session'} is writing in ${project.name}. Track it with git once that turn ends.`,
      );
    }
    let commit: FirstCommit;
    try {
      commit = await makeFirstCommit({ path: project.rootPath, include });
    } finally {
      await releaseWriteSet({ entries: lease.entries, holder }).catch((error: unknown) =>
        get().reportError({
          title: `Couldn't hand ${project.name} back to sessions after the first commit`,
          error,
          severity: 'warning',
        }),
      );
    }
    if (isUnbornRepo) {
      await get().loadProjectGitStatus({ projectId });
      return { project, commit };
    }
    const check = await validateGitRepo(commit.rootPath);
    if (check.isRepo === false) {
      throw new Error(check.error ?? 'the folder is still not a git repository');
    }
    const rootPath = check.rootPath ?? commit.rootPath;
    await updateProjectKind({ db: tauriDatabase, id: projectId, kind: 'repo', rootPath });
    const converted: Project = {
      ...project,
      kind: 'repo',
      rootPath,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };
    set((state) => ({
      projects: state.projects.map((candidate) =>
        candidate.id === projectId ? converted : candidate,
      ),
    }));
    return { project: converted, commit };
  };
};
