import { PULL_REQUEST_NOUNS, REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type { MountPullRequestProvider, PrCheckRun } from '@goodboy/types';
import type { MountRequestView } from '../../store/slices/project-mounts/mountRowModel';
import type { PullRequestPresentationState } from '../../shared/pullRequestPresentation';
import { pullRequestKindOf } from '../../shared/pullRequestKind';
import { countSlotText } from '../../shared/utils/countSlotText';
import { checksCountsOf, type ChecksCounts } from '../integrations/github/checksRollup';
import { pullRequestStateWordOf } from './pullRequestStateWordOf';

type BranchRowSignalKind = 'failing' | 'conflict' | 'behind';

type BranchRowSignal = {
  readonly kind: BranchRowSignalKind;
  readonly tone: 'danger' | 'warning';
  readonly text: string;
};

export type BranchRowFacts = {
  readonly title: string;
  readonly isBranchTitle: boolean;
  readonly branch: string;
  readonly state: PullRequestPresentationState;
  readonly stateWord: string | null;
  readonly number: string | null;
  readonly host: MountPullRequestProvider | null;
  readonly hostName: string | null;
  readonly isFinished: boolean;
  readonly rank: number;
  readonly checks: ChecksCounts | null;
  readonly signal: BranchRowSignal | null;
  readonly label: string;
};

type Params = {
  readonly branch: string;
  readonly mountName: string;
  readonly request: MountRequestView | null;
  readonly checks: ReadonlyArray<PrCheckRun> | null;
  readonly behind: number | null;
  readonly conflicts: number | null;
};

const RANK: Readonly<Record<PullRequestPresentationState, number>> = {
  queued: 0,
  approved: 1,
  open: 2,
  draft: 3,
  none: 4,
  merged: 5,
  closed: 6,
};

type SignalParams = Pick<Params, 'behind' | 'conflicts'> & {
  readonly counts: ChecksCounts | null;
  readonly isChecksFailing: boolean;
};

const signalOf = ({
  counts,
  isChecksFailing,
  conflicts,
  behind,
}: SignalParams): BranchRowSignal | null => {
  if (counts !== null && counts.failing > 0) {
    return { kind: 'failing', tone: 'danger', text: `${counts.failing} failing` };
  }
  if (counts === null && isChecksFailing) {
    return { kind: 'failing', tone: 'danger', text: 'Failing' };
  }
  if (conflicts !== null && conflicts > 0) {
    return { kind: 'conflict', tone: 'warning', text: 'Conflict' };
  }
  const behindText = countSlotText({ count: behind });
  return behindText === null
    ? null
    : { kind: 'behind', tone: 'warning', text: `${behindText} behind` };
};

export const branchRowFactsOf = ({
  branch,
  mountName,
  request,
  checks,
  behind,
  conflicts,
}: Params): BranchRowFacts => {
  const name = branch === '' ? mountName : branch;
  const state: PullRequestPresentationState =
    request === null
      ? 'none'
      : pullRequestKindOf({ state: request.state, isDraft: request.isDraft });
  const isFinished = state === 'merged' || state === 'closed';
  const title = request === null || request.title.trim() === '' ? name : request.title;
  const counts = checks === null ? null : checksCountsOf({ checks });
  const signal = isFinished
    ? null
    : signalOf({ counts, isChecksFailing: request?.checks === 'failure', conflicts, behind });
  const number =
    request === null
      ? null
      : `${PULL_REQUEST_NOUNS[request.provider].numberPrefix}${request.number}`;
  const stateWord = pullRequestStateWordOf({ state });
  const isBranchTitle = title === name;
  return {
    title,
    isBranchTitle,
    branch: name,
    state,
    stateWord,
    number,
    host: request === null ? null : request.provider,
    hostName: request === null ? null : REVIEW_SOURCE_LABEL[request.provider],
    isFinished,
    rank: RANK[state],
    checks: counts,
    signal,
    label: [
      title,
      number,
      stateWord,
      isBranchTitle ? null : `branch ${name}`,
      signal === null ? null : signal.text,
    ]
      .filter((part) => part !== null)
      .join(', '),
  };
};
