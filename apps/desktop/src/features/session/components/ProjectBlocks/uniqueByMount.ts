import type { MountCleanupProposal } from '@goodboy/types';

type Params = {
  readonly proposals: ReadonlyArray<MountCleanupProposal>;
};

export const uniqueByMount = ({ proposals }: Params): ReadonlyArray<MountCleanupProposal> => {
  const seen = new Set<string>();
  return proposals.filter((proposal) => {
    if (seen.has(proposal.mountId)) {
      return false;
    }
    seen.add(proposal.mountId);
    return true;
  });
};
