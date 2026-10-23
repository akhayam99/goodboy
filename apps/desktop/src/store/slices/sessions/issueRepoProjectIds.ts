import type { Project, ProjectId, SessionExternalTaskProvider } from '@goodboy/types';
import { recordRepoProjectIds } from '../../../features/inbox/recordRepoProjectIds';
import { repoProjectsOf } from '../../../features/inbox/repoProjectsOf';

type IssueSource = {
  readonly provider: SessionExternalTaskProvider;
  readonly url: string;
};

type Params = {
  readonly issues: ReadonlyArray<IssueSource>;
  readonly projects: ReadonlyArray<Project>;
  readonly gitlabHosts: ReadonlyArray<string>;
};

export const issueRepoProjectIds = ({
  issues,
  projects,
  gitlabHosts,
}: Params): ReadonlyArray<ProjectId> => {
  const ids = new Set<ProjectId>();
  for (const issue of issues) {
    const host = issue.provider === 'github' || issue.provider === 'gitlab' ? issue.provider : null;
    if (host === null) {
      continue;
    }
    const repos = repoProjectsOf({ host, projects, gitlabHosts });
    for (const id of recordRepoProjectIds({ host, url: issue.url, repos })) {
      ids.add(id);
    }
  }
  return [...ids];
};
