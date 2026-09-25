import type { BitbucketParticipant } from '../../client';
import type { BitbucketPrVote } from './bitbucketPrVote';

type Params = {
  readonly participants: ReadonlyArray<BitbucketParticipant>;
  readonly vote: BitbucketPrVote;
};

const MINE: Record<BitbucketPrVote, string> = {
  approved: 'You approved this pull request',
  'changes-requested': 'You asked for changes',
  none: 'You have not voted yet',
  unknown: 'Goodboy cannot tell whether you voted',
};

type CountParams = {
  readonly count: number;
  readonly singular: string;
  readonly plural: string;
};

const countPhrase = ({ count, singular, plural }: CountParams): string =>
  `${count} ${count === 1 ? singular : plural}`;

export const voteSummary = ({ participants, vote }: Params): string => {
  const approvals = participants.filter((participant) => participant.approved).length;
  const changeRequests = participants.filter(
    (participant) => participant.state === 'changes_requested',
  ).length;
  const parts: ReadonlyArray<string> = [
    approvals > 0
      ? countPhrase({ count: approvals, singular: 'approval', plural: 'approvals' })
      : '',
    changeRequests > 0
      ? countPhrase({
          count: changeRequests,
          singular: 'change request',
          plural: 'change requests',
        })
      : '',
  ].filter((part) => part !== '');
  if (parts.length === 0) {
    return `${MINE[vote]}. Nobody has voted on it yet`;
  }
  return `${MINE[vote]}. ${parts.join(', ')} so far`;
};
