import type { PrCheckRun, PullRequestReviewer, PullRequestState } from '@goodboy/types';
import type { PullRequestPresentationState } from '../../../../shared/utils/pullRequestPresentation';
import { checksCountsOf, checksGroupsOf } from '../../../integrations/github/checksRollup';
import type { PrMergeReadiness } from '../../../review/prMergeReadiness';
import { mergeIsClear } from '../../../review/prMergeReadiness';
import { BRANCH_STATE_TONE } from '../../../session/central/branches/branchStateTone';
import type { StatusCell } from './statusCell';

export type PullRequestBranchFacts = {
  readonly ahead: number;
  readonly behind: number | null;
  readonly onlineAhead: number;
  readonly isRebasing: boolean;
};

type Params = {
  readonly state: PullRequestPresentationState;
  readonly pr: Pick<PullRequestState, 'baseBranch' | 'reviewDecision'>;
  readonly runs: ReadonlyArray<PrCheckRun> | null;
  readonly isChecksUnread: boolean;
  readonly people: ReadonlyArray<PullRequestReviewer>;
  readonly readiness: PrMergeReadiness;
  readonly hasConflicts: boolean;
  readonly mergeWord: string;
  readonly queueLine: string | null;
  readonly branch: PullRequestBranchFacts;
};

type ChecksParams = Pick<Params, 'runs' | 'isChecksUnread'>;

const checksCell = ({ runs, isChecksUnread }: ChecksParams): StatusCell => {
  const cell = { id: 'checks' as const, label: 'Checks', opens: 'checks' as const };
  if (runs === null || runs.length === 0) {
    return isChecksUnread
      ? { ...cell, word: 'Unknown', detail: "couldn't read them", tone: 'neutral' }
      : { ...cell, word: 'No checks', detail: null, tone: 'neutral' };
  }
  const counts = checksCountsOf({ checks: runs });
  if (counts.failing > 0) {
    const failing = checksGroupsOf({ checks: runs }).find((group) => group.group === 'failing');
    return {
      ...cell,
      word: `${counts.failing} failing`,
      detail: failing?.runs.map((run) => run.name).join(', ') ?? null,
      tone: BRANCH_STATE_TONE['checks-failing'],
    };
  }
  if (counts.running > 0) {
    return {
      ...cell,
      word: `Running, ${counts.passed + counts.skipped} of ${runs.length}`,
      detail: null,
      tone: BRANCH_STATE_TONE['checks-running'],
    };
  }
  return counts.passed > 0
    ? { ...cell, word: `${counts.passed} passed`, detail: null, tone: 'success' }
    : { ...cell, word: `${counts.skipped} skipped`, detail: null, tone: 'neutral' };
};

type PeopleParams = {
  readonly people: ReadonlyArray<PullRequestReviewer>;
  readonly states: ReadonlyArray<PullRequestReviewer['state']>;
};

const loginsIn = ({ people, states }: PeopleParams): string | null => {
  const logins = people
    .filter((reviewer) => states.includes(reviewer.state))
    .map((reviewer) => reviewer.person.login);
  return logins.length === 0 ? null : logins.join(', ');
};

type ReviewParams = Pick<Params, 'state' | 'pr' | 'people'>;

const reviewCell = ({ state, pr, people }: ReviewParams): StatusCell => {
  const cell = { id: 'review' as const, label: 'Review', opens: null };
  if (state === 'draft') {
    return { ...cell, word: 'Draft', detail: 'not open for review', tone: 'neutral' };
  }
  if (pr.reviewDecision === 'approved') {
    const by = loginsIn({ people, states: ['approved'] });
    return {
      ...cell,
      word: 'Approved',
      detail: by === null ? null : `by ${by}`,
      tone: BRANCH_STATE_TONE.approved,
    };
  }
  if (pr.reviewDecision === 'changes_requested') {
    const by = loginsIn({ people, states: ['changes_requested'] });
    return {
      ...cell,
      word: 'Changes requested',
      detail: by === null ? null : `by ${by}`,
      tone: BRANCH_STATE_TONE['changes-requested'],
    };
  }
  const waiting = loginsIn({ people, states: ['pending'] });
  if (waiting !== null) {
    return {
      ...cell,
      word: 'Waiting',
      detail: `on ${waiting}`,
      tone: BRANCH_STATE_TONE['in-review'],
    };
  }
  if (pr.reviewDecision === 'review_required') {
    return {
      ...cell,
      word: 'No approval yet',
      detail: people.length === 0 ? 'nobody asked' : null,
      tone: 'warning',
    };
  }
  return {
    ...cell,
    word: 'No review yet',
    detail: people.length === 0 ? 'nobody asked' : null,
    tone: 'neutral',
  };
};

type MergeParams = Pick<
  Params,
  'state' | 'pr' | 'readiness' | 'hasConflicts' | 'mergeWord' | 'queueLine'
>;

const blockedDetailOf = ({ readiness }: Pick<Params, 'readiness'>): string => {
  if (readiness.labelBlocker === null) {
    return readiness.word;
  }
  if (readiness.labelBlocker.endsWith('failing') || readiness.labelBlocker.startsWith('checks')) {
    return 'by checks';
  }
  return 'by review';
};

const mergeCell = ({
  state,
  pr,
  readiness,
  hasConflicts,
  mergeWord,
  queueLine,
}: MergeParams): StatusCell => {
  const cell = { id: 'merge' as const, label: 'Merge', opens: null };
  switch (state) {
    case 'merged':
      return { ...cell, word: 'Merged', detail: `into ${pr.baseBranch}`, tone: 'merged' };
    case 'closed':
      return { ...cell, word: 'Closed', detail: 'not merged', tone: 'neutral' };
    case 'queued':
      return {
        ...cell,
        word: 'Queued',
        detail: queueLine ?? readiness.word,
        tone: BRANCH_STATE_TONE.queued,
      };
    case 'draft':
      return { ...cell, word: 'Blocked', detail: 'by draft', tone: 'neutral' };
    case 'none':
    case 'open':
    case 'approved':
      break;
    default: {
      const unexpected: never = state;
      return unexpected;
    }
  }
  if (hasConflicts) {
    return {
      ...cell,
      word: 'Conflicts',
      detail: `with ${pr.baseBranch}`,
      tone: BRANCH_STATE_TONE.conflicts,
    };
  }
  if (mergeIsClear({ readiness })) {
    return {
      ...cell,
      word: 'Ready',
      detail: `${mergeWord} into ${pr.baseBranch}`,
      tone: BRANCH_STATE_TONE.ready,
    };
  }
  if (readiness.labelBlocker === 'checks running') {
    return { ...cell, word: 'Waiting', detail: 'on checks', tone: 'info' };
  }
  if (readiness.status === 'unknown') {
    return { ...cell, word: 'Checking', detail: readiness.word, tone: 'neutral' };
  }
  if (readiness.status === 'ready') {
    return { ...cell, word: 'Ready', detail: readiness.word, tone: 'warning' };
  }
  return { ...cell, word: 'Blocked', detail: blockedDetailOf({ readiness }), tone: 'neutral' };
};

type BranchParams = Pick<Params, 'state' | 'pr' | 'branch'>;

const branchCell = ({ state, pr, branch }: BranchParams): StatusCell => {
  const cell = { id: 'branch' as const, label: 'Branch', opens: null };
  const base = pr.baseBranch;
  if (state === 'merged') {
    return { ...cell, word: 'Can be deleted', detail: null, tone: 'neutral' };
  }
  if (branch.isRebasing) {
    return {
      ...cell,
      word: 'Rebasing',
      detail: branch.behind === null ? `onto ${base}` : `${branch.behind} behind ${base}`,
      tone: BRANCH_STATE_TONE.rebasing,
    };
  }
  if (branch.onlineAhead > 0) {
    return {
      ...cell,
      word: 'Diverged',
      detail: `${branch.ahead} here, ${branch.onlineAhead} online`,
      tone: 'warning',
    };
  }
  if (branch.behind === null) {
    return { ...cell, word: 'Unknown', detail: null, tone: 'neutral' };
  }
  if (branch.behind > 0) {
    return {
      ...cell,
      word: `${branch.behind} behind ${base}`,
      detail: `${base} moved`,
      tone: 'neutral',
    };
  }
  return { ...cell, word: 'Up to date', detail: `with ${base}`, tone: 'neutral' };
};

export const pullRequestCellsOf = ({
  state,
  pr,
  runs,
  isChecksUnread,
  people,
  readiness,
  hasConflicts,
  mergeWord,
  queueLine,
  branch,
}: Params): ReadonlyArray<StatusCell> => [
  checksCell({ runs, isChecksUnread }),
  reviewCell({ state, pr, people }),
  mergeCell({ state, pr, readiness, hasConflicts, mergeWord, queueLine }),
  branchCell({ state, pr, branch }),
];
