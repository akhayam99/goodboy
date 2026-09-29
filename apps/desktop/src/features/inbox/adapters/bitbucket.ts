import type { BitbucketPrGroup } from '../../integrations/bitbucket/BitbucketStudio/useBitbucketPrs';
import type { BitbucketRepo } from '../../integrations/bitbucket/client';
import { bitbucketPrStateKind } from '../../integrations/bitbucket/bitbucketPrStateKind';
import type { InboxRecord } from '../types';
import { requestInboxState } from '../requestInboxState';
import { stateWord } from '../stateWord';
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
      state: requestInboxState({ kind: bitbucketPrStateKind({ state: pullRequest.state }) }),
      stateLabel: stateWord({ value: pullRequest.state }),
      updatedAt: pullRequest.updatedOn,
      url: pullRequest.webUrl ?? '',
      context: repo == null ? group.label : `${repo.workspaceSlug}/${repo.repoSlug}`,
      payload: { provider: 'bitbucket', kind: 'pr', pullRequest, repo },
    })),
  );
