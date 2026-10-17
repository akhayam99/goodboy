import type { PrCheckRun } from '@goodboy/types';
import type { PullRequestPresentationState } from '../../shared/pullRequestPresentation';
import type { BranchTab } from '../../store/slices/navigation/types';
import { countSlotText } from '../../shared/utils/countSlotText';
import { checksCountsOf, checksWordOf } from '../integrations/github/checksRollup';
import { pullRequestStateWordOf } from './pullRequestStateWordOf';

type WorktreeEntryTone = 'danger' | 'warning' | 'info' | null;

type WorktreeEntryFact = {
  readonly text: string | null;
  readonly tone: WorktreeEntryTone;
  readonly tooltip: string | null;
};

export type WorktreeEntryFacts = Readonly<Record<BranchTab, WorktreeEntryFact>>;

type Params = {
  readonly pullRequestState: PullRequestPresentationState;
  readonly commentsNeedYou: number;
  readonly files: number | null;
  readonly notPushed: number | null;
  readonly checks: ReadonlyArray<PrCheckRun> | null;
  readonly checksUnreadReason: string | null;
};

const EMPTY: WorktreeEntryFact = { text: null, tone: null, tooltip: null };

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
    return { text: countSlotText({ count: counts.failing }), tone: 'danger', tooltip: word };
  }
  if (counts.running > 0) {
    return { text: countSlotText({ count: counts.running }), tone: 'info', tooltip: word };
  }
  return { ...EMPTY, tooltip: word };
};

type NotPushedParams = Pick<Params, 'notPushed'>;

const commitsFactOf = ({ notPushed }: NotPushedParams): WorktreeEntryFact => {
  if (notPushed === null || notPushed <= 0) {
    return EMPTY;
  }
  const countWord = `${notPushed} not pushed`;
  return { text: `↑${notPushed}`, tone: null, tooltip: countWord };
};

export const worktreeEntryFactsOf = ({
  pullRequestState,
  commentsNeedYou,
  files,
  notPushed,
  checks,
  checksUnreadReason,
}: Params): WorktreeEntryFacts => {
  const needsYou = countSlotText({ count: commentsNeedYou });
  const needsYouWord = `${commentsNeedYou} need you`;
  return {
    pr: pullRequestFactOf({ pullRequestState }),
    comments:
      needsYou === null ? EMPTY : { text: needsYou, tone: 'warning', tooltip: needsYouWord },
    files: files === null ? EMPTY : { ...EMPTY, text: countSlotText({ count: files }) },
    commits: commitsFactOf({ notPushed }),
    checks: checksFactOf({ checks, checksUnreadReason }),
  };
};
