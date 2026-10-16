import type { Project, ProjectId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { runWithConcurrency } from '../../../shared/lib/concurrency';
import { checkoutUpdateBase } from '../../../shared/lib/repo';

export type PullOutcome =
  | {
      readonly kind: 'updated';
      readonly projectId: ProjectId;
      readonly name: string;
      readonly base: string;
      readonly checkoutBranch: string | null;
      readonly commits: number;
    }
  | {
      readonly kind: 'skipped' | 'failed';
      readonly projectId: ProjectId;
      readonly name: string;
      readonly reason: string;
    };

type PullParams = {
  readonly projects: ReadonlyArray<Project>;
};

const PULL_CONCURRENCY = 4;

const UNREACHABLE =
  /unable to access|could not resolve|could not read from remote|timed out|network/i;

type ReasonParams = {
  readonly reason: string;
};

const isUnreachable = ({ reason }: ReasonParams): boolean => UNREACHABLE.test(reason);

export const pullBaseInRepos = async ({
  projects,
}: PullParams): Promise<ReadonlyArray<PullOutcome>> => {
  const outcomes = new Map<ProjectId, PullOutcome>();
  await runWithConcurrency({
    items: projects,
    limit: PULL_CONCURRENCY,
    run: async (project) => {
      try {
        const result = await checkoutUpdateBase({
          checkoutPath: project.rootPath,
          baseBranch: project.baseBranch ?? null,
          workspaceId: project.workspaceId,
          projectId: project.id,
        });
        outcomes.set(project.id, {
          kind: 'updated',
          projectId: project.id,
          name: project.name,
          base: result.base,
          checkoutBranch: result.checkoutBranch,
          commits: result.commitsPulled,
        });
      } catch (error) {
        const reason = formatError(error);
        outcomes.set(project.id, {
          kind: isUnreachable({ reason }) ? 'failed' : 'skipped',
          projectId: project.id,
          name: project.name,
          reason,
        });
      }
    },
  });
  return projects.flatMap((project) => outcomes.get(project.id) ?? []);
};
