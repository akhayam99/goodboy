import type {
  BitbucketPullRequest,
  BitbucketPullRequestState,
} from '../../features/integrations/bitbucket/client';
import { StateBadge } from '@goodboy/ui';
import { pullRequestStateTone } from '../../features/integrations/bitbucket/stateTone';
import { formatAbsoluteDateTime } from '../utils/relativeDate';
import type { DetailFieldRegistry } from './types';

const STATE_LABEL: Record<BitbucketPullRequestState, string> = {
  OPEN: 'open',
  MERGED: 'merged',
  DECLINED: 'declined',
  SUPERSEDED: 'superseded',
};

export const bitbucketPullRequestFields: DetailFieldRegistry<BitbucketPullRequest> = [
  {
    kind: 'field',
    key: 'state',
    label: 'State',
    render: ({ entity }) => (
      <StateBadge tone={pullRequestStateTone({ state: entity.state })}>
        {STATE_LABEL[entity.state]}
      </StateBadge>
    ),
  },
  {
    kind: 'field',
    key: 'sourceBranch',
    label: 'Source branch',
    render: ({ entity }) => <span className="font-mono">{entity.sourceBranch}</span>,
  },
  {
    kind: 'field',
    key: 'destinationBranch',
    label: 'Target branch',
    render: ({ entity }) => <span className="font-mono">{entity.destinationBranch}</span>,
  },
  {
    kind: 'field',
    key: 'approvals',
    label: 'Approvals',
    render: ({ entity }) => {
      const approved = entity.participants.filter((participant) => participant.approved).length;
      if (approved === 0) {
        return null;
      }
      return `${approved} of ${entity.reviewers.length > 0 ? entity.reviewers.length : approved}`;
    },
  },
  {
    kind: 'field',
    key: 'comments',
    label: 'Comments',
    render: ({ entity }) => (entity.commentCount > 0 ? String(entity.commentCount) : null),
  },
  {
    kind: 'field',
    key: 'updated',
    label: 'Updated',
    render: ({ entity }) => formatAbsoluteDateTime({ iso: entity.updatedOn }),
  },
];
