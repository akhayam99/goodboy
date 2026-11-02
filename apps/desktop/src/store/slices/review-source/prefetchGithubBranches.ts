import { listPrsForBranches } from '@goodboy/core';
import type { MountId, ProjectId, PullRequestState, WorkspaceId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/integrations/github/github';
import { runWithLimit } from '../../../shared/utils/runWithLimit';
import { REVIEW_REFRESH_CONCURRENCY } from './requestRefreshConcurrency';

const MIN_BRANCHES_PER_BATCH = 2;

export type GithubSweepTarget = Readonly<{
  mountId: MountId;
  repoSlug: string;
  branch: string;
  cwd: string;
  workspaceId: WorkspaceId;
  projectId: ProjectId;
}>;

type Params = Readonly<{
  targets: ReadonlyArray<GithubSweepTarget>;
}>;

type RepoGroup = {
  readonly first: GithubSweepTarget;
  readonly members: Array<GithubSweepTarget>;
};

export const prefetchGithubBranches = async ({
  targets,
}: Params): Promise<ReadonlyMap<MountId, ReadonlyArray<PullRequestState>>> => {
  const groups = new Map<string, RepoGroup>();
  for (const target of targets) {
    const group = groups.get(target.repoSlug);
    if (group === undefined) {
      groups.set(target.repoSlug, { first: target, members: [target] });
      continue;
    }
    group.members.push(target);
  }
  const prefetched = new Map<MountId, ReadonlyArray<PullRequestState>>();
  const tasks = [...groups.entries()]
    .filter(
      ([, group]) =>
        new Set(group.members.map((member) => member.branch)).size >= MIN_BRANCHES_PER_BATCH,
    )
    .map(([repoSlug, group]) => async (): Promise<void> => {
      const byBranch = await listPrsForBranches({
        runner: tauriGhRunner,
        repo: repoSlug,
        branches: group.members.map((member) => member.branch),
        opts: {
          cwd: group.first.cwd,
          workspaceId: group.first.workspaceId,
          projectId: group.first.projectId,
        },
      });
      if (byBranch === null) {
        return;
      }
      for (const member of group.members) {
        const states = byBranch.get(member.branch);
        if (states !== undefined) {
          prefetched.set(member.mountId, states);
        }
      }
    });
  if (tasks.length === 0) {
    return prefetched;
  }
  await runWithLimit({ tasks, limit: REVIEW_REFRESH_CONCURRENCY });
  return prefetched;
};
