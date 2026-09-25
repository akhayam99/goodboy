import type { ResolveQueueFilter } from '../../store/slices/session-view';
import type { ResolveQueueRow } from './buildResolveQueueRows';
import { isDecidedUnpublished } from './publishCounts';
import type { ResolveUiState } from './resolveRowState';

export type ResolveQueueGroups = {
  readonly needsReview: ReadonlyArray<ResolveQueueRow>;
  readonly approved: ReadonlyArray<ResolveQueueRow>;
  readonly active: ReadonlyArray<ResolveQueueRow>;
  readonly retryable: ReadonlyArray<ResolveQueueRow>;
  readonly completed: ReadonlyArray<ResolveQueueRow>;
  readonly later: ReadonlyArray<ResolveQueueRow>;
};

export type ResolveQueueListGroup = {
  readonly key: string;
  readonly attemptId: string | null;
  readonly rows: ReadonlyArray<ResolveQueueRow>;
};

const NEEDS_REVIEW_STATUSES: ReadonlySet<ResolveUiState> = new Set([
  'new',
  'ready',
  'needs_you',
  'failed',
]);

const RETRYABLE_STATUSES: ReadonlySet<ResolveUiState> = new Set(['failed']);

const HISTORY_STATUSES: ReadonlySet<ResolveUiState> = new Set(['later', 'resolved']);

const DECIDED_STATUSES: ReadonlySet<ResolveUiState> = new Set(['approved']);

const reviewerTimeOf = ({ row }: { readonly row: ResolveQueueRow }): number =>
  row.reviewerNote?.createdAtMs ?? row.thread.createdAt;

const byReviewerTime = (a: ResolveQueueRow, b: ResolveQueueRow): number =>
  reviewerTimeOf({ row: a }) - reviewerTimeOf({ row: b });

type RankParams = {
  readonly row: ResolveQueueRow;
};

const askedRank = ({ row }: RankParams): number => (row.status === 'needs_you' ? 0 : 1);

const byAgentQuestionThenTime = (a: ResolveQueueRow, b: ResolveQueueRow): number => {
  const rank = askedRank({ row: a }) - askedRank({ row: b });
  return rank === 0 ? byReviewerTime(a, b) : rank;
};

export const groupResolveQueue = ({
  rows,
}: {
  readonly rows: ReadonlyArray<ResolveQueueRow>;
}): ResolveQueueGroups => ({
  needsReview: rows
    .filter((row) => NEEDS_REVIEW_STATUSES.has(row.status))
    .slice()
    .sort(byAgentQuestionThenTime),
  approved: rows
    .filter((row) => DECIDED_STATUSES.has(row.status) && isDecidedUnpublished(row))
    .slice()
    .sort(byReviewerTime),
  active: rows
    .filter((row) => !HISTORY_STATUSES.has(row.status))
    .slice()
    .sort(byReviewerTime),
  retryable: rows
    .filter((row) => RETRYABLE_STATUSES.has(row.status))
    .slice()
    .sort(byReviewerTime),
  completed: rows
    .filter((row) => row.status === 'resolved')
    .slice()
    .sort(byReviewerTime),
  later: rows
    .filter((row) => row.status === 'later')
    .slice()
    .sort(byReviewerTime),
});

export const groupSharedRuns = ({
  rows,
}: {
  readonly rows: ReadonlyArray<ResolveQueueRow>;
}): ReadonlyArray<ResolveQueueListGroup> => {
  const groups: Array<{
    readonly key: string;
    readonly attemptId: string | null;
    readonly rows: Array<ResolveQueueRow>;
  }> = [];
  const indexByAttemptId = new Map<string, number>();
  for (const row of rows) {
    const attemptId = row.thread.activeAttemptId;
    if (attemptId === null) {
      groups.push({ key: row.thread.threadId, attemptId: null, rows: [row] });
      continue;
    }
    const index = indexByAttemptId.get(attemptId);
    if (index === undefined) {
      indexByAttemptId.set(attemptId, groups.length);
      groups.push({ key: attemptId, attemptId, rows: [row] });
      continue;
    }
    groups[index]?.rows.push(row);
  }
  return groups.map((group) => ({
    key: group.key,
    attemptId: group.rows.length > 1 ? group.attemptId : null,
    rows: group.rows,
  }));
};

export const rowsForResolveFilter = ({
  groups,
  filter,
}: {
  readonly groups: ResolveQueueGroups;
  readonly filter: ResolveQueueFilter;
}): ReadonlyArray<ResolveQueueRow> => {
  if (filter === 'needs_review') {
    return [...groups.needsReview, ...groups.approved];
  }
  return filter === 'retryable' ? groups.retryable : groups.active;
};
