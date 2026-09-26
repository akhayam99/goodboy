import type { Project, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { runWithConcurrency } from '../../../shared/lib/concurrency';
import { projectGitRowStatusOf } from '../../../shared/lib/projectGitPresentation';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly workspaceId: WorkspaceId;
};

const UPDATE_CONCURRENCY = 4;

const isUpdatable = ({ project, get }: { readonly project: Project; readonly get: GetFn }) => {
  const status = get().projectGitStatus[project.id] ?? null;
  return status?.state === 'ready' && projectGitRowStatusOf({ status }).updatable;
};

export const fastForwardProjectCheckouts = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId }: Input): Promise<void> => {
    const projects = get().projects.filter(
      (project) =>
        project.workspaceId === workspaceId &&
        project.kind === 'repo' &&
        isUpdatable({ project, get }),
    );
    if (projects.length === 0) {
      return;
    }
    for (const project of projects) {
      set((state) => ({
        projectCheckoutResult: {
          ...state.projectCheckoutResult,
          [project.id]: { kind: 'updating' },
        },
      }));
    }
    await runWithConcurrency({
      items: projects,
      limit: UPDATE_CONCURRENCY,
      run: async (project) => {
        const before = get().projectGitStatus[project.id] ?? null;
        const behindBefore =
          before?.state === 'ready' && before.upstreamDistance.kind === 'known'
            ? before.upstreamDistance.behind
            : 0;
        try {
          await get().fastForwardProjectCheckout({ projectId: project.id });
          set((state) => ({
            projectCheckoutResult: {
              ...state.projectCheckoutResult,
              [project.id]: { kind: 'updated', commits: behindBefore },
            },
          }));
        } catch (error) {
          set((state) => ({
            projectCheckoutResult: {
              ...state.projectCheckoutResult,
              [project.id]: { kind: 'failed', reason: formatError(error) },
            },
          }));
        }
      },
    });
  };
};
