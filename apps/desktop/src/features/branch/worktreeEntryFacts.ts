import type { PrCheckRun } from '@goodboy/types';
import type { PullRequestPresentationState } from '../../shared/utils/pullRequestPresentation';
import type { BranchTab } from '../../store/slices/navigation/types';
import { countSlotText } from '../../shared/utils/countSlotText';
import { joinFacts } from '../../shared/utils/joinFacts';
import { checksCountsOf, checksWordOf } from '../integrations/github/checksRollup';
import { pullRequestStateWordOf } from './pullRequestStateWordOf';

type WorktreeEntryTone = 'danger' | 'warning' | 'info' | null;

export type EntryDiffStat = {
  readonly additions: number;
  readonly deletions: number;
};

type WorktreeEntryFact = {
  readonly text: string | null;
  readonly tone: WorktreeEntryTone;
  readonly tooltip: string | null;
  readonly diff: EntryDiffStat | null;
};

export type WorktreeEntryFacts = Readonly<Record<BranchTab, WorktreeEntryFact>>;

type Params = {
  readonly pullRequestState: PullRequestPresentationState;
  readonly commentsNeedYou: number;
  readonly files: number | null;
  readonly diff: EntryDiffStat | null;
  readonly notPushed: number | null;
  readonly checks: ReadonlyArray<PrCheckRun> | null;
  readonly checksUnreadReason: string | null;
};

const EMPTY: WorktreeEntryFact = { text: null, tone: null, tooltip: null, diff: null };

const SLOT_STATES: ReadonlySet<PullRequestPresentationState> =
  new Set<PullRequestPresentationState>(['draft', 'merged', 'closed']);

type PullRequestParams = Pick<Params, 'pullRequestState'>;

const pullRequestFactOf = ({ pullRequestState }: PullRequestParams): WorktreeEntryFact =>
  SLOT_STATES.has(pullRequestState)
    ? { ...EMPTY, text: pullRequestStateWordOf({ state: pullRequestState }) }
    : EMPTY;

type ChecksParams = Pick<Params, 'checks' | 'checksUnreadReason'>;

const checksFactOf = ({ checks, checksUnreadReason }: ChecksParams): WorktreeEntryFact => {
  if (checks === null) {
    return { ...EMPTY, tooltip: checksUnreadReason };
  }
  const counts = checksCountsOf({ checks });
  const word = checksWordOf({ runs: checks });
  if (counts.failing > 0) {
    return {
      ...EMPTY,
      text: countSlotText({ count: counts.failing }),
      tone: 'danger',
      tooltip: word,
    };
  }
  if (counts.running > 0) {
    return {
      ...EMPTY,
      text: countSlotText({ count: counts.running }),
      tone: 'info',
      tooltip: word,
    };
  }
  return { ...EMPTY, tooltip: word };
};

type NotPushedParams = Pick<Params, 'notPushed'>;

const commitsFactOf = ({ notPushed }: NotPushedParams): WorktreeEntryFact => {
  if (notPushed === null || notPushed <= 0) {
    return EMPTY;
  }
  const countWord = `${notPushed} not pushed`;
  return { ...EMPTY, text: `↑${notPushed}`, tooltip: countWord };
};

type FilesParams = Pick<Params, 'files' | 'diff'>;

const filesFactOf = ({ files, diff }: FilesParams): WorktreeEntryFact => {
  const count = countSlotText({ count: files });
  const shownDiff = diff !== null && (diff.additions > 0 || diff.deletions > 0) ? diff : null;
  if (count === null && shownDiff === null) {
    return EMPTY;
  }
  if (shownDiff === null) {
    return { ...EMPTY, text: count };
  }
  const tooltip = joinFacts({
    facts: [
      count === null ? null : `${count} ${files === 1 ? 'file' : 'files'}`,
      `+${shownDiff.additions} -${shownDiff.deletions}`,
    ],
  });
  return { text: count, tone: null, tooltip, diff: shownDiff };
};

export const worktreeEntryFactsOf = ({
  pullRequestState,
  commentsNeedYou,
  files,
  diff,
  notPushed,
  checks,
  checksUnreadReason,
}: Params): WorktreeEntryFacts => {
  const needsYou = countSlotText({ count: commentsNeedYou });
  const needsYouWord = `${commentsNeedYou} need you`;
  return {
    pr: pullRequestFactOf({ pullRequestState }),
    comments:
      needsYou === null
        ? EMPTY
        : { ...EMPTY, text: needsYou, tone: 'warning', tooltip: needsYouWord },
    files: filesFactOf({ files, diff }),
    commits: commitsFactOf({ notPushed }),
    checks: checksFactOf({ checks, checksUnreadReason }),
  };
};
