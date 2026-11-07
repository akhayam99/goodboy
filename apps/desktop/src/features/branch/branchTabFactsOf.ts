import type { PrCheckRun } from '@goodboy/types';
import type { PullRequestPresentationState } from '../../shared/utils/pullRequestPresentation';
import type { BranchTab } from '../../store/slices/navigation/types';
import { countNoun } from '../../shared/utils/countNoun';
import { countSlotText } from '../../shared/utils/countSlotText';
import { checksCountsOf } from '../integrations/github/checksRollup';
import {
  worktreeEntryFactsOf,
  type EntryDiffStat,
  type WorktreeEntryFacts,
} from './worktreeEntryFacts';

export type BranchTabFact = {
  readonly text: string | null;
  readonly tone: 'danger' | 'warning' | 'info' | null;
  readonly tooltip: string | null;
  readonly diff: EntryDiffStat | null;
};

export type BranchTabFacts = Readonly<Record<BranchTab, BranchTabFact>>;

type Params = {
  readonly pullRequestState: PullRequestPresentationState;
  readonly commentsNeedYou: number;
  readonly commentsOpen: number;
  readonly files: number | null;
  readonly diff: EntryDiffStat | null;
  readonly commits: number | null;
  readonly notPushed: number | null;
  readonly checks: ReadonlyArray<PrCheckRun> | null;
  readonly checksUnreadReason: string | null;
};

type EntryParams = {
  readonly entry: WorktreeEntryFacts[BranchTab];
};

const plainOf = ({ entry }: EntryParams): BranchTabFact => ({
  text: entry.text,
  tone: entry.tone,
  tooltip: entry.tooltip,
  diff: entry.diff,
});

type ChecksParams = EntryParams & Pick<Params, 'checks'>;

const checksFactOf = ({ checks, entry }: ChecksParams): BranchTabFact => {
  if (entry.text !== null || checks === null) {
    return plainOf({ entry });
  }
  const passed = checksCountsOf({ checks }).passed;
  return { ...plainOf({ entry }), text: countSlotText({ count: passed }) };
};

type CommentsParams = Pick<Params, 'commentsNeedYou' | 'commentsOpen'>;

const commentsFactOf = ({ commentsNeedYou, commentsOpen }: CommentsParams): BranchTabFact => {
  const open = countSlotText({ count: commentsOpen });
  if (commentsNeedYou > 0) {
    return {
      text: open ?? countSlotText({ count: commentsNeedYou }),
      tone: 'warning',
      tooltip: `${commentsNeedYou} need you`,
      diff: null,
    };
  }
  return {
    text: open,
    tone: null,
    tooltip: open === null ? null : `${countNoun({ count: commentsOpen, one: 'comment' })} open`,
    diff: null,
  };
};

export const branchTabFactsOf = ({
  pullRequestState,
  commentsNeedYou,
  commentsOpen,
  files,
  diff,
  commits,
  notPushed,
  checks,
  checksUnreadReason,
}: Params): BranchTabFacts => {
  const entries = worktreeEntryFactsOf({
    pullRequestState,
    commentsNeedYou,
    files,
    diff,
    commits,
    notPushed,
    checks,
    checksUnreadReason,
  });
  return {
    pr: plainOf({ entry: entries.pr }),
    comments: commentsFactOf({ commentsNeedYou, commentsOpen }),
    files: plainOf({ entry: entries.files }),
    commits: plainOf({ entry: entries.commits }),
    checks: checksFactOf({ checks, entry: entries.checks }),
  };
};
