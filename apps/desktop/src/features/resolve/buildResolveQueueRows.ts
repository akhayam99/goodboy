import type {
  PrComment,
  ResolveAttempt,
  ResolvePublicationThread,
  ResolveQueueItem,
  ResolveQueueItemWithThread,
  ResolveThread,
} from '@goodboy/types';
import { groupThreads, type CommentThread } from '../github/comment-threads';
import { prCommentLocation } from '../session/pr-comment-location';
import {
  isDeliveryComplete,
  resolveDeliveryReceiptsFor,
} from '../../store/slices/resolve/deliveryReceipts';
import {
  resolveProposalKind,
  type ResolveProposalKind,
} from '../../store/slices/resolve/resolveProposalKind';
import {
  resolveRowState,
  type ResolveFailedStep,
  type ResolveRowState,
  type ResolveUiState,
} from './resolveRowState';

export type ResolveQueueReviewerNote = {
  readonly body: string;
  readonly author: string;
  readonly createdAtMs: number;
  readonly location: string | null;
  readonly path: string | null;
  readonly line: number | null;
};

export type ResolveQueueDelivery = {
  readonly isReplyPosted: boolean;
  readonly replyPostedAt: number | null;
  readonly isThreadResolved: boolean;
  readonly resolvedAt: number | null;
  readonly isComplete: boolean;
  readonly replyBody: string | null;
};

export type ResolveQueueRow = {
  readonly item: ResolveQueueItem;
  readonly thread: ResolveThread;
  readonly commentThread: CommentThread | null;
  readonly status: ResolveUiState;
  readonly rowState: ResolveRowState;
  readonly attempt: ResolveAttempt | null;
  readonly reviewerNote: ResolveQueueReviewerNote | null;
  readonly proposal: string | null;
  readonly proposalKind: ResolveProposalKind;
  readonly coveredThreadIds: ReadonlyArray<string>;
  readonly delivery: ResolveQueueDelivery | null;
};

type Params = {
  readonly entries: ReadonlyArray<ResolveQueueItemWithThread>;
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly deliveryReceipts: ReadonlyArray<ResolvePublicationThread>;
  readonly comments: ReadonlyArray<PrComment>;
};

const commentThreadByThreadId = ({
  comments,
}: {
  readonly comments: ReadonlyArray<PrComment>;
}): ReadonlyMap<string, CommentThread> => {
  const map = new Map<string, CommentThread>();
  const threads = groupThreads(comments.filter((comment) => comment.source === 'review'));
  for (const thread of threads) {
    const threadId = thread.head.threadId;
    if (threadId == null || threadId === '') {
      continue;
    }
    map.set(threadId, thread);
  }
  return map;
};

const reviewerNoteOf = ({
  thread,
}: {
  readonly thread: CommentThread | null;
}): ResolveQueueReviewerNote | null =>
  thread === null
    ? null
    : {
        body: thread.head.body,
        author: thread.head.author,
        createdAtMs: Date.parse(thread.head.createdAt),
        location: prCommentLocation({ comment: thread.head }),
        path: thread.head.path ?? null,
        line: thread.head.line ?? null,
      };

const coveredThreadIdsFor = ({
  thread,
  entries,
}: {
  readonly thread: ResolveThread;
  readonly entries: ReadonlyArray<ResolveQueueItemWithThread>;
}): ReadonlyArray<string> => {
  if (thread.activeAttemptId === null) {
    return [];
  }
  return entries
    .filter(
      (entry) =>
        entry.thread.activeAttemptId === thread.activeAttemptId &&
        entry.thread.threadId !== thread.threadId,
    )
    .map((entry) => entry.thread.threadId);
};

const deliveryFor = ({
  item,
  thread,
  deliveryReceipts,
}: {
  readonly item: ResolveQueueItem;
  readonly thread: ResolveThread;
  readonly deliveryReceipts: ReadonlyArray<ResolvePublicationThread>;
}): ResolveQueueDelivery | null => {
  const receipts = resolveDeliveryReceiptsFor({ item, thread, deliveryReceipts });
  const latest = receipts.reduce<ResolvePublicationThread | null>(
    (best, receipt) =>
      best === null || (receipt.replyAttemptedAt ?? 0) >= (best.replyAttemptedAt ?? 0)
        ? receipt
        : best,
    null,
  );
  if (latest === null) {
    return null;
  }
  return {
    isReplyPosted: latest.replyPhase === 'posted',
    replyPostedAt: latest.replyPostedAt,
    isThreadResolved: thread.githubResolved === true,
    resolvedAt: latest.resolvedAt,
    isComplete: isDeliveryComplete({ receipt: latest }),
    replyBody: latest.replyBody,
  };
};

const PUBLICATION_FAILED = 'publication_failed:';

const publicationErrorOf = ({ thread }: { readonly thread: ResolveThread }): string | null => {
  const reason = thread.stateReason;
  if (reason === null || !reason.startsWith(PUBLICATION_FAILED)) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(reason.slice(PUBLICATION_FAILED.length));
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      return typeof parsed.error === 'string' ? parsed.error : null;
    }
    return null;
  } catch {
    return null;
  }
};

const failedStepOf = ({
  receipts,
  thread,
}: {
  readonly receipts: ReadonlyArray<ResolvePublicationThread>;
  readonly thread: ResolveThread;
}): ResolveFailedStep => {
  const broken = receipts.filter(
    (receipt) =>
      receipt.error !== null ||
      receipt.replyPhase === 'uncertain' ||
      receipt.resolvePhase === 'uncertain',
  );
  const latest = broken.at(-1);
  if (latest !== undefined) {
    if (latest.replyPhase === 'uncertain' || latest.resolvePhase === 'uncertain') {
      return 'uncertain';
    }
    if (latest.replyPhase !== 'posted' && latest.replyPhase !== 'skipped') {
      return 'reply';
    }
    return 'resolve';
  }
  return publicationErrorOf({ thread }) === null ? 'run' : 'push';
};

export const buildResolveQueueRows = ({
  entries,
  attempts,
  deliveryReceipts,
  comments,
}: Params): ReadonlyArray<ResolveQueueRow> => {
  const commentThreads = commentThreadByThreadId({ comments });
  return entries.map(({ item, thread }) => {
    const commentThread = commentThreads.get(thread.threadId) ?? null;
    const attempt =
      thread.activeAttemptId === null
        ? null
        : (attempts.find((candidate) => candidate.id === thread.activeAttemptId) ?? null);
    const proposalKind = resolveProposalKind({ item, thread });
    const delivery = deliveryFor({ item, thread, deliveryReceipts });
    const receipts = resolveDeliveryReceiptsFor({ item, thread, deliveryReceipts });
    const rowState = resolveRowState({
      stage: thread.stage,
      proposalKind,
      failedStep: thread.stage === 'failed' ? failedStepOf({ receipts, thread }) : null,
      isLeftOpen: delivery !== null && !delivery.isThreadResolved,
      pushedSha: item.integratedSha ?? thread.commitShas?.at(-1) ?? null,
      pushError: publicationErrorOf({ thread }),
    });
    return {
      item,
      thread,
      commentThread,
      status: rowState.state,
      rowState,
      attempt,
      reviewerNote: reviewerNoteOf({ thread: commentThread }),
      proposal: thread.replyDraft,
      proposalKind,
      coveredThreadIds: coveredThreadIdsFor({ thread, entries }),
      delivery,
    };
  });
};
