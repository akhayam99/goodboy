import type { PullRequestPresentationState } from '../../shared/pullRequestPresentation';
import type { BranchTab } from '../../store/slices/navigation/types';
import { countSlotText } from '../../shared/utils/countSlotText';

type WorktreeEntryTone = 'danger' | 'warning' | null;

export type WorktreeEntryFact = {
  readonly text: string | null;
  readonly tone: WorktreeEntryTone;
};

export type WorktreeEntryFacts = Readonly<Record<BranchTab, WorktreeEntryFact>>;

type WorktreePullRequestFact = {
  readonly label: string;
  readonly state: PullRequestPresentationState;
};

type Params = {
  readonly pullRequest: WorktreePullRequestFact | null;
  readonly comments: number | null;
  readonly commentsWaiting: number;
  readonly files: number | null;
  readonly commits: number | null;
  readonly notPushed: number | null;
  readonly checks: number | null;
  readonly checksFailed: number;
};

type CountParams = {
  readonly count: number | null;
};

const STATE_WORD: Readonly<Record<PullRequestPresentationState, string | null>> = {
  none: null,
  draft: 'Draft',
  open: null,
  approved: 'Approved',
  queued: 'Queued',
  merged: 'Merged',
  closed: 'Closed',
};

const countFactOf = ({ count }: CountParams): WorktreeEntryFact => ({
  text: count === null ? null : (countSlotText({ count }) ?? ''),
  tone: null,
});

const pullRequestFactOf = ({ pullRequest }: Pick<Params, 'pullRequest'>): WorktreeEntryFact => {
  if (pullRequest === null) {
    return { text: 'None', tone: null };
  }
  const word = STATE_WORD[pullRequest.state];
  return { text: word === null ? pullRequest.label : `${pullRequest.label} ${word}`, tone: null };
};

export const worktreeEntryFactsOf = ({
  pullRequest,
  comments,
  commentsWaiting,
  files,
  commits,
  notPushed,
  checks,
  checksFailed,
}: Params): WorktreeEntryFacts => ({
  pr: pullRequestFactOf({ pullRequest }),
  comments: {
    ...countFactOf({ count: comments }),
    tone: commentsWaiting > 0 ? 'warning' : null,
  },
  files: countFactOf({ count: files }),
  commits:
    notPushed !== null && notPushed > 0
      ? { text: `${notPushed} not pushed`, tone: null }
      : countFactOf({ count: commits }),
  checks:
    checksFailed > 0
      ? { text: `${checksFailed} failed`, tone: 'danger' }
      : { text: checks === null || checks === 0 ? '' : String(checks), tone: null },
});
