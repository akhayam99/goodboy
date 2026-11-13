import type { PrCheckRun, PullRequestReviewer, PullRequestState } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import type { PullRequestPresentationState } from '../../../../../shared/utils/pullRequestPresentation';
import { countNoun } from '../../../../../shared/utils/countNoun';
import {
  checksCountsOf,
  checksGroupsOf,
  checksSummaryOf,
} from '../../../../integrations/github/checksRollup';
import type { MergeReadinessFacts, PrMergeReadiness } from '../../../../review/prMergeReadiness';
import { mergeIsClear } from '../../../../review/prMergeReadiness';
import type { BranchDueStep } from '../../../branchStepOf';
import { BRANCH_STATE_TONE } from '../../../../session/central/branches/branchStateTone';
import { openThreadsLineOf } from '../openThreadsLineOf';
import type { MergeBox, MergeBoxRow, MergeBoxVerdict } from './mergeBox';
import { verdictStepTextOf, type VerdictStepFacts } from './verdictStepTextOf';

export type PullRequestBranchFacts = {
  readonly ahead: number;
  readonly behind: number | null;
  readonly onlineAhead: number;
  readonly isRebasing: boolean;
};

export type MergeBoxThreads = {
  readonly unresolved: number;
  readonly needYou: number;
  readonly unread: number;
};

type Params = {
  readonly state: PullRequestPresentationState;
  readonly pr: Pick<PullRequestState, 'baseBranch' | 'reviewDecision' | 'mergeable'>;
  readonly runs: ReadonlyArray<PrCheckRun> | null;
  readonly isChecksUnread: boolean;
  readonly checks: Pick<MergeReadinessFacts, 'checks' | 'failingChecks' | 'runningChecks'>;
  readonly reviewers: ReadonlyArray<PullRequestReviewer>;
  readonly readiness: PrMergeReadiness;
  readonly hasConflicts: boolean;
  readonly mergeWord: string;
  readonly queueLine: string | null;
  readonly branch: PullRequestBranchFacts;
  readonly steps: ReadonlyArray<BranchDueStep>;
  readonly threads: MergeBoxThreads;
  readonly unpushed: number;
  readonly canRequestReview: boolean;
};

type Part = {
  readonly rows: ReadonlyArray<MergeBoxRow>;
  readonly passing: ReadonlyArray<string>;
};

const NOTHING: Part = { rows: [], passing: [] };

type RowParams = {
  readonly row: MergeBoxRow;
};

const rowOnly = ({ row }: RowParams): Part => ({ rows: [row], passing: [] });

type PassParams = {
  readonly pass: string;
};

const passOnly = ({ pass }: PassParams): Part => ({ rows: [], passing: [pass] });

type ChecksParams = Pick<Params, 'runs' | 'isChecksUnread' | 'checks'>;

type FailingParams = {
  readonly count: number;
  readonly names: ReadonlyArray<string>;
};

const failingPart = ({ count, names }: FailingParams): Part =>
  rowOnly({
    row: {
      id: 'checks',
      glyph: 'failing',
      title: countNoun({ count, one: 'check failing', many: 'checks failing' }),
      detail: names.length === 0 ? null : names.join(', '),
      tone: BRANCH_STATE_TONE['checks-failing'],
      opens: 'checks',
    },
  });

type UnknownParams = {
  readonly isBlocker: boolean;
};

const unknownPart = ({ isBlocker }: UnknownParams): Part =>
  rowOnly({
    row: {
      id: 'checks',
      glyph: 'unknown',
      title: 'Checks unknown',
      detail: "Couldn't read them",
      tone: isBlocker ? 'warning' : 'neutral',
      opens: 'checks',
    },
  });

const checksFromFactsPart = ({ checks, isChecksUnread }: Omit<ChecksParams, 'runs'>): Part => {
  if (checks.checks === 'failing') {
    return failingPart({
      count: Math.max(checks.failingChecks.length, 1),
      names: checks.failingChecks,
    });
  }
  if (checks.checks === 'pending') {
    return rowOnly({
      row: {
        id: 'checks',
        glyph: 'running',
        title: 'Checks running',
        detail: null,
        tone: BRANCH_STATE_TONE['checks-running'],
        opens: 'checks',
      },
    });
  }
  if (checks.checks === 'unknown' || isChecksUnread) {
    return unknownPart({ isBlocker: checks.checks === 'unknown' });
  }
  return NOTHING;
};

const checksPart = ({ runs, isChecksUnread, checks }: ChecksParams): Part => {
  if (runs === null || runs.length === 0) {
    return checksFromFactsPart({ checks, isChecksUnread });
  }
  const counts = checksCountsOf({ checks: runs });
  if (counts.failing > 0) {
    const failing = checksGroupsOf({ checks: runs }).find((group) => group.group === 'failing');
    return failingPart({
      count: counts.failing,
      names: failing?.runs.map((run) => run.name) ?? [],
    });
  }
  if (counts.running > 0) {
    return rowOnly({
      row: {
        id: 'checks',
        glyph: 'running',
        title: 'Checks running',
        detail: `${counts.passed + counts.skipped} of ${runs.length} done`,
        tone: BRANCH_STATE_TONE['checks-running'],
        opens: 'checks',
      },
    });
  }
  const summary = checksSummaryOf({ runs });
  return summary === null ? NOTHING : passOnly({ pass: summary.line });
};

type LoginsParams = {
  readonly reviewers: ReadonlyArray<PullRequestReviewer>;
  readonly states: ReadonlyArray<PullRequestReviewer['state']>;
};

const loginsIn = ({ reviewers, states }: LoginsParams): string | null => {
  const logins = reviewers
    .filter((reviewer) => states.includes(reviewer.state))
    .map((reviewer) => reviewer.person.login);
  return logins.length === 0 ? null : logins.join(', ');
};

type ReviewParams = Pick<Params, 'state' | 'pr' | 'reviewers' | 'threads' | 'canRequestReview'>;

const reviewPart = ({ state, pr, reviewers, threads, canRequestReview }: ReviewParams): Part => {
  if (state === 'draft') {
    return NOTHING;
  }
  if (pr.reviewDecision === 'approved') {
    const by = loginsIn({ reviewers, states: ['approved'] });
    return passOnly({ pass: by === null ? 'Approved' : `Approved by ${by}` });
  }
  if (pr.reviewDecision === 'changes_requested') {
    const by = loginsIn({ reviewers, states: ['changes_requested'] });
    return rowOnly({
      row: {
        id: 'review',
        glyph: 'changes',
        title: by === null ? 'Changes requested' : `Changes requested by ${by}`,
        detail: openThreadsLineOf({
          unresolved: threads.unresolved,
          unreadCount: threads.unread,
          needYou: threads.needYou,
        }),
        tone: BRANCH_STATE_TONE['changes-requested'],
        opens: 'comments',
      },
    });
  }
  const waiting = loginsIn({ reviewers, states: ['pending'] });
  const isRequired = pr.reviewDecision === 'review_required';
  if (waiting !== null) {
    return rowOnly({
      row: {
        id: 'review',
        glyph: 'waiting',
        title: `Waiting on ${waiting}`,
        detail: isRequired ? null : 'Not required to merge',
        tone: isRequired ? BRANCH_STATE_TONE['in-review'] : 'neutral',
        opens: 'comments',
      },
    });
  }
  const isNobodyAsked = reviewers.length === 0;
  const asks = isNobodyAsked && canRequestReview ? ('reviewers' as const) : null;
  if (pr.reviewDecision === 'review_required') {
    return rowOnly({
      row: {
        id: 'review',
        glyph: 'ask',
        title: 'No approval yet',
        detail: isNobodyAsked ? 'Nobody asked yet' : null,
        tone: 'info',
        opens: asks ?? 'comments',
      },
    });
  }
  if (!isNobodyAsked) {
    return NOTHING;
  }
  return rowOnly({
    row: {
      id: 'review',
      glyph: 'ask',
      title: 'No review yet',
      detail: 'Nobody asked yet',
      tone: 'neutral',
      opens: asks,
    },
  });
};

type CommentsParams = Pick<Params, 'pr' | 'threads'>;

const commentsPart = ({ pr, threads }: CommentsParams): Part => {
  if (pr.reviewDecision === 'changes_requested' || threads.unresolved === 0) {
    return NOTHING;
  }
  const unread = threads.unread > 0 ? `${threads.unread} unread` : null;
  if (threads.needYou > 0) {
    const open = countNoun({ count: threads.unresolved, one: 'open thread' });
    return rowOnly({
      row: {
        id: 'comments',
        glyph: 'comments',
        title: countNoun({
          count: threads.needYou,
          one: 'thread needs you',
          many: 'threads need you',
        }),
        detail: [open, unread].filter((part): part is string => part !== null).join(' · '),
        tone: 'warning',
        opens: 'comments',
      },
    });
  }
  return rowOnly({
    row: {
      id: 'comments',
      glyph: 'comments',
      title: countNoun({ count: threads.unresolved, one: 'open thread' }),
      detail: unread,
      tone: 'neutral',
      opens: 'comments',
    },
  });
};

type ConflictsParams = Pick<Params, 'pr' | 'hasConflicts' | 'branch'>;

const conflictsPart = ({ pr, hasConflicts, branch }: ConflictsParams): Part => {
  const base = pr.baseBranch;
  if (!hasConflicts) {
    return pr.mergeable === true ? passOnly({ pass: 'No conflicts' }) : NOTHING;
  }
  const behind = branch.behind ?? 0;
  return rowOnly({
    row: {
      id: 'conflicts',
      glyph: 'conflicts',
      title: `Conflicts with ${base}`,
      detail:
        behind > 0 ? `${base} moved ${countNoun({ count: behind, one: 'commit' })} ahead` : null,
      tone: BRANCH_STATE_TONE.conflicts,
      opens: 'files',
    },
  });
};

const unpushedPart = ({ unpushed }: Pick<Params, 'unpushed'>): Part =>
  unpushed > 0
    ? rowOnly({
        row: {
          id: 'unpushed',
          glyph: 'push',
          title: countNoun({
            count: unpushed,
            one: 'commit not pushed',
            many: 'commits not pushed',
          }),
          detail: "The pull request doesn't have them yet",
          tone: 'warning',
          opens: 'commits',
        },
      })
    : NOTHING;

type BranchParams = Pick<Params, 'pr' | 'branch' | 'hasConflicts'>;

const branchPart = ({ pr, branch, hasConflicts }: BranchParams): Part => {
  const base = pr.baseBranch;
  if (branch.isRebasing) {
    return rowOnly({
      row: {
        id: 'branch',
        glyph: 'rebasing',
        title: `Rebasing onto ${base}`,
        detail: branch.behind === null ? null : `${branch.behind} behind ${base}`,
        tone: 'warning',
        opens: 'commits',
      },
    });
  }
  if (branch.onlineAhead > 0) {
    return rowOnly({
      row: {
        id: 'branch',
        glyph: 'diverged',
        title: 'Diverged from the online branch',
        detail: `${branch.ahead} here, ${branch.onlineAhead} online`,
        tone: 'warning',
        opens: 'commits',
      },
    });
  }
  if (branch.behind === null || hasConflicts) {
    return NOTHING;
  }
  if (branch.behind === 0) {
    return passOnly({ pass: `Up to date with ${base}` });
  }
  return rowOnly({
    row: {
      id: 'branch',
      glyph: 'behind',
      title: `${countNoun({ count: branch.behind, one: 'commit' })} behind ${base}`,
      detail: `${base} moved`,
      tone: 'neutral',
      opens: 'commits',
    },
  });
};

const TONE_RANK: Readonly<Record<Tone, number>> = {
  danger: 0,
  warning: 1,
  info: 2,
  neutral: 3,
  primary: 4,
  unread: 4,
  merged: 4,
  draft: 4,
  success: 4,
};

type BlockingParams = Pick<MergeBoxRow, 'tone'>;

const isBlocking = ({ tone }: BlockingParams): boolean => tone === 'danger' || tone === 'warning';

type StepsParams = {
  readonly steps: ReadonlyArray<BranchDueStep>;
  readonly facts: VerdictStepFacts;
};

const stepsLineOf = ({ steps, facts }: StepsParams): string | null => {
  const texts = steps.slice(0, 2).map((step) => verdictStepTextOf({ step, facts }));
  if (texts.length === 0) {
    return null;
  }
  const sentence = texts.join(', then ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
};

type FailingCountParams = Pick<Params, 'runs' | 'checks'>;

const failingCountOf = ({ runs, checks }: FailingCountParams): number => {
  if (runs !== null && runs.length > 0) {
    return checksCountsOf({ checks: runs }).failing;
  }
  return Math.max(checks.failingChecks.length, 1);
};

type OpenVerdictParams = Pick<Params, 'readiness' | 'mergeWord' | 'pr' | 'reviewers'> & {
  readonly rows: ReadonlyArray<MergeBoxRow>;
  readonly stepsLine: string | null;
};

const openVerdictOf = ({
  rows,
  stepsLine,
  readiness,
  mergeWord,
  pr,
  reviewers,
}: OpenVerdictParams): MergeBoxVerdict => {
  const top = rows.find(isBlocking);
  if (top !== undefined) {
    return {
      kind: 'blocked',
      word: 'Not ready to merge',
      line: stepsLine ?? readiness.reason,
      tone: top.tone,
    };
  }
  if (readiness.status === 'unknown') {
    return { kind: 'checking', word: 'Checking', line: readiness.reason, tone: 'neutral' };
  }
  const waiting = rows.filter(
    (row) => row.tone === 'info' && (row.id === 'checks' || row.id === 'review'),
  );
  const isOnlyWaiting =
    waiting.length > 0 &&
    readiness.status === 'blocked' &&
    waiting.length === readiness.blockers.length;
  if (isOnlyWaiting) {
    const isOnChecks = waiting.some((row) => row.id === 'checks');
    const isOnReview = waiting.some((row) => row.id === 'review');
    if (isOnChecks && isOnReview) {
      return {
        kind: 'waiting',
        word: 'Waiting for checks and a review',
        line: 'It can merge once the checks pass and someone approves.',
        tone: 'info',
      };
    }
    if (isOnChecks) {
      return {
        kind: 'waiting',
        word: 'Waiting for checks',
        line: 'It can merge once they pass.',
        tone: 'info',
      };
    }
    return {
      kind: 'waiting',
      word: 'Waiting for a review',
      line:
        reviewers.length === 0
          ? 'Nobody has been asked yet.'
          : 'It can merge once someone approves.',
      tone: 'info',
    };
  }
  if (readiness.status === 'blocked') {
    return { kind: 'blocked', word: 'Not ready to merge', line: readiness.reason, tone: 'neutral' };
  }
  if (mergeIsClear({ readiness })) {
    return {
      kind: 'ready',
      word: 'Ready to merge',
      line: `${mergeWord} into ${pr.baseBranch}. Nothing is waiting.`,
      tone: BRANCH_STATE_TONE.ready,
    };
  }
  return { kind: 'ready', word: 'Ready to merge', line: readiness.word, tone: 'warning' };
};

type SettledVerdictParams = Pick<Params, 'state' | 'pr' | 'queueLine' | 'readiness'> & {
  readonly draftLine: string | null;
};

const settledVerdictOf = ({
  state,
  pr,
  queueLine,
  readiness,
  draftLine,
}: SettledVerdictParams): MergeBoxVerdict | null => {
  switch (state) {
    case 'merged':
      return { kind: 'merged', word: `Merged into ${pr.baseBranch}`, line: null, tone: 'merged' };
    case 'closed':
      return { kind: 'closed', word: 'Closed without merging', line: null, tone: 'neutral' };
    case 'queued':
      return {
        kind: 'queued',
        word: 'Queued to merge',
        line: queueLine ?? readiness.word,
        tone: BRANCH_STATE_TONE.queued,
      };
    case 'draft':
      return {
        kind: 'draft',
        word: 'Draft',
        line: draftLine ?? "Reviewers aren't notified until you mark it ready.",
        tone: 'neutral',
      };
    case 'none':
    case 'open':
    case 'approved':
      return null;
    default: {
      const unexpected: never = state;
      return unexpected;
    }
  }
};

export const mergeBoxOf = ({
  state,
  pr,
  runs,
  isChecksUnread,
  checks,
  reviewers,
  readiness,
  hasConflicts,
  mergeWord,
  queueLine,
  branch,
  steps,
  threads,
  unpushed,
  canRequestReview,
}: Params): MergeBox => {
  const stepsLine = stepsLineOf({
    steps,
    facts: {
      base: pr.baseBranch,
      changesBy:
        pr.reviewDecision === 'changes_requested'
          ? loginsIn({ reviewers, states: ['changes_requested'] })
          : null,
      failing: failingCountOf({ runs, checks }),
      hasConflicts,
      isRebasing: branch.isRebasing,
      mergeWord,
    },
  });
  const isMarkReadyFirst = steps[0] === undefined || steps[0] === 'markReady';
  const settled = settledVerdictOf({
    state,
    pr,
    queueLine,
    readiness,
    draftLine: isMarkReadyFirst ? null : stepsLine,
  });
  if (settled !== null && (settled.kind === 'merged' || settled.kind === 'closed')) {
    return { verdict: settled, rows: [], passing: [] };
  }
  const parts = [
    checksPart({ runs, isChecksUnread, checks }),
    conflictsPart({ pr, hasConflicts, branch }),
    unpushedPart({ unpushed }),
    reviewPart({ state, pr, reviewers, threads, canRequestReview }),
    commentsPart({ pr, threads }),
    branchPart({ pr, branch, hasConflicts }),
  ];
  const rows = parts
    .flatMap((part) => part.rows)
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const byTone = TONE_RANK[left.row.tone] - TONE_RANK[right.row.tone];
      return byTone === 0 ? left.index - right.index : byTone;
    })
    .map(({ row }) => row);
  const verdict =
    settled ?? openVerdictOf({ rows, stepsLine, readiness, mergeWord, pr, reviewers });
  return { verdict, rows, passing: parts.flatMap((part) => part.passing) };
};
