import type { BitbucketPrGroup } from '../../integrations/bitbucket/BitbucketStudio/useBitbucketPrs';
import type { BitbucketRepo } from '../../integrations/bitbucket/client';
import type { InboxRecord } from '../types';
type Params = {
  readonly groups: ReadonlyArray<BitbucketPrGroup>;
  readonly repo: BitbucketRepo | null;
};
export const adaptBitbucketPrs = ({ groups, repo }: Params): InboxRecord[] =>
  groups.flatMap((group) =>
    group.rows.map((pullRequest) => ({
      key: `bitbucket:pr:${pullRequest.id}`,
      provider: 'bitbucket',
      kind: 'pr',
      identifier: `#${pullRequest.id}`,
      title: pullRequest.title,
      state: pullRequest.state === 'OPEN' ? 'open' : 'done',
      updatedAt: pullRequest.updatedOn,
      url: pullRequest.webUrl ?? '',
      meta: repo == null ? group.label : `${repo.workspaceSlug}/${repo.repoSlug}`,
      payload: { provider: 'bitbucket', kind: 'pr', pullRequest, repo },
    })),
  );
