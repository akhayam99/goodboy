import { BadgeCheck, GitBranch, UserRound } from 'lucide-react';
import type { BitbucketPullRequest } from '../../features/integrations/bitbucket/client';
import type { FactRegistry } from './factTypes';
import { timeFact } from './timeFact';

export const bitbucketPullRequestFields: FactRegistry<BitbucketPullRequest> = {
  person: ({ entity }) =>
    entity.author == null
      ? null
      : { key: 'author', label: 'Author', icon: UserRound, node: entity.author.displayName },
  place: ({ entity }) => ({
    key: 'branches',
    label: 'Source and target branch',
    icon: GitBranch,
    node: (
      <span className="font-mono">{`${entity.sourceBranch} → ${entity.destinationBranch}`}</span>
    ),
  }),
  measure: ({ entity }) => {
    const approved = entity.participants.filter((participant) => participant.approved).length;
    const expected = Math.max(entity.reviewers.length, approved);
    return {
      key: 'approvals',
      label: 'Approvals',
      icon: BadgeCheck,
      node: expected === 0 ? null : `${approved} of ${expected} approvals`,
    };
  },
  time: ({ entity }) => timeFact({ label: 'Updated', iso: entity.updatedOn }),
};
