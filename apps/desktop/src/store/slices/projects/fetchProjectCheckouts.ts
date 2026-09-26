import type { Project, WorkspaceId } from '@goodboy/types';
import { projectFetch } from '../../../shared/lib/repo';
import { runWithConcurrency } from '../../../shared/lib/concurrency';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly workspaceId: WorkspaceId;
};

const THROTTLE_MS = 5 * 60 * 1000;
const FETCH_CONCURRENCY = 4;

const isDue = ({
  project,
  fetchedAt,
  now,
}: {
  readonly project: Project;
  readonly fetchedAt: number | undefined;
  readonly now: number;
}): boolean =>
  project.kind === 'repo' && (fetchedAt === undefined || now - fetchedAt >= THROTTLE_MS);

export const fetchProjectCheckouts = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId }: Input): Promise<void> => {
    const now = Date.now();
    const projects = get().projects.filter(
      (project) =>
        project.workspaceId === workspaceId &&
        isDue({ project, fetchedAt: get().projectFetchedAt[project.id], now }),
    );
    if (projects.length === 0) {
      return;
    }
    await runWithConcurrency({
      items: projects,
      limit: FETCH_CONCURRENCY,
      run: async (project) => {
        await projectFetch({
          projectPath: project.rootPath,
          workspaceId: project.workspaceId,
          projectId: project.id,
        }).catch(() => undefined);
        set((state) => ({
          projectFetchedAt: { ...state.projectFetchedAt, [project.id]: Date.now() },
        }));
        await get().loadProjectGitStatus({ projectId: project.id });
      },
    });
  };
};
