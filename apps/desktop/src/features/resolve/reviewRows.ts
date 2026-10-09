import type {
  DiffComment,
  PrComment,
  ResolveAttempt,
  ResolveQueueItemWithThread,
  SessionId,
} from '@goodboy/types';
import type { AppState } from '../../store/types';
import {
  activeReviewSourceOf,
  selectedReviewEntryOf,
} from '../../store/slices/review-source/activeReviewSource';
import { rowBelongsToSource } from '../../store/slices/review-source/rowBelongsToSource';
import { buildResolveQueueRows, type ResolveQueueRow } from './buildResolveQueueRows';
import { draftReplyText, type ResolveItemDraft } from './resolveItemDraft';
import { reviewCommentStateOf, type ReviewCommentState } from './reviewCommentState';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

const EMPTY_ENTRIES: ReadonlyArray<ResolveQueueItemWithThread> = [];
const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];
const EMPTY_COMMENTS: ReadonlyArray<PrComment> = [];
const EMPTY_NOTES: ReadonlyArray<DiffComment> = [];
const NO_ROWS: ReadonlyArray<ResolveQueueRow> = [];

export const launchRowsOf = ({ state, sessionId }: Params): ReadonlyArray<ResolveQueueRow> =>
  buildResolveQueueRows({
    entries: state.sessionResolveQueueItems[sessionId] ?? EMPTY_ENTRIES,
    attempts: state.sessionResolveAttempts[sessionId] ?? EMPTY_ATTEMPTS,
    deliveryReceipts: [],
    comments: activeReviewSourceOf({ state, sessionId })?.comments ?? EMPTY_COMMENTS,
    notes: state.diffComments[sessionId] ?? EMPTY_NOTES,
  });

export const reviewRowsOf = ({ state, sessionId }: Params): ReadonlyArray<ResolveQueueRow> => {
  const entry = selectedReviewEntryOf({ state, sessionId });
  if (entry === null) {
    return NO_ROWS;
  }
  return launchRowsOf({ state, sessionId }).filter((row) =>
    rowBelongsToSource({ row: row.thread, entry }),
  );
};

export const threadRowsOf = ({ state, sessionId }: Params): ReadonlyArray<ResolveQueueRow> => {
  const entry = selectedReviewEntryOf({ state, sessionId });
  return launchRowsOf({ state, sessionId }).filter(
    (row) =>
      row.thread.originKind === 'diff_comment' ||
      (entry !== null && rowBelongsToSource({ row: row.thread, entry })),
  );
};

type DraftParams = {
  readonly draft: ResolveItemDraft | undefined;
  readonly row: ResolveQueueRow;
};

export const isReplyEdited = ({ draft, row }: DraftParams): boolean =>
  draft?.reply != null && draft.reply !== (row.proposal ?? '');

export const replyOf = ({ draft, row }: DraftParams): string =>
  draft === undefined ? (row.proposal ?? '') : draftReplyText({ draft, proposal: row.proposal });

type RowStateParams = Params & {
  readonly row: ResolveQueueRow;
};

export const rowStateOf = ({ state, sessionId, row }: RowStateParams): ReviewCommentState =>
  reviewCommentStateOf({
    row,
    isEdited: isReplyEdited({
      draft: state.resolveItemDrafts[sessionId]?.[row.thread.threadId],
      row,
    }),
    isChanged:
      state.sessionResolveSourceSnapshots[sessionId]?.[row.thread.threadId]?.changed != null,
  });
