import type { BitbucketRepo } from '../../../features/integrations/bitbucket/client';
import type { MountFetch } from '../project-mounts/mountRequests';
import type { MountBitbucketPrState } from './state';
import { bitbucketRepository } from './bitbucketPrLink';

type Params = {
  readonly target: MountFetch;
  readonly repo: BitbucketRepo;
};

export const blankBitbucketEntry = ({ target, repo }: Params): MountBitbucketPrState => ({
  kind: 'bitbucket',
  mountId: target.mount.id,
  projectId: target.mount.projectId,
  revision: target.mount.revision,
  host: null,
  repo,
  repository: bitbucketRepository({ workspaceSlug: repo.workspaceSlug, repoSlug: repo.repoSlug }),
  branch: target.mount.branch,
  prs: [],
  links: [],
  checks: null,
  reviewDecision: null,
  pr: null,
  selected: null,
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
});
