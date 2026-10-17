import type { BaseDivergence, Project } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { repoBaseDivergence } from '../../../shared/lib/repo';
import { createLatestOnly } from '../state-writes/latestOnly';
import type { GetFn, SetFn } from './types';

const LATEST = createLatestOnly();

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly project: Project;
  readonly maxAgeMs: number;
};

type FailedParams = {
  readonly project: Project;
  readonly error: unknown;
};

const failedReport = ({ project, error }: FailedParams): BaseDivergence => ({
  state: 'fetch-failed',
  base: project.baseBranch ?? null,
  upstream: null,
  ahead: 0,
  behind: 0,
  checkoutBranch: null,
  uncommitted: 0,
  message: formatError(error),
});

export const readRepoDivergence = async ({
  set,
  get,
  project,
  maxAgeMs,
}: Params): Promise<void> => {
  const apply = (report: BaseDivergence | null | undefined): void => {
    if (report === null || report === undefined) {
      return;
    }
    set((state) => ({ repoDivergence: { ...state.repoDivergence, [project.id]: report } }));
  };
  let isApplied = false;
  try {
    const outcome = await LATEST.run({
      key: project.id,
      request: (): Promise<BaseDivergence | null | undefined> =>
        repoBaseDivergence({
          projectPath: project.rootPath,
          baseBranch: project.baseBranch ?? null,
          maxAgeMs,
          workspaceId: project.workspaceId,
          projectId: project.id,
        }),
      apply,
    });
    isApplied = outcome === 'applied';
  } catch (error) {
    apply(failedReport({ project, error }));
    isApplied = true;
  }
  if (isApplied) {
    await get().loadProjectGitStatus({ projectId: project.id });
  }
};
