import type { MountPullRequestLink } from '@goodboy/types';
import type { MountRequestView } from '../mountRowModel';

type Params = {
  readonly link: MountPullRequestLink;
};

export const storedRequestOf = ({ link }: Params): MountRequestView => {
  const label = link.provider === 'gitlab' ? `MR !${link.prNumber}` : `PR #${link.prNumber}`;
  return {
    provider: link.provider,
    identity: {
      provider: link.provider,
      host: link.host,
      repoSlug: link.repoSlug,
      prNumber: link.prNumber,
    },
    number: link.prNumber,
    state: link.state,
    isDraft: link.state === 'draft',
    checks: null,
    reviewDecision: null,
    url: link.url,
    title: label,
    label,
    mergedHeadSha: link.mergedHeadSha ?? null,
    headSha: null,
  };
};
