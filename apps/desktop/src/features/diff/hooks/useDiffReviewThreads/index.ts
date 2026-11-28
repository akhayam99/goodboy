import { useCallback, useEffect, useMemo } from 'react';
import { REVIEW_SOURCE_CAPABILITIES } from '@goodboy/core/review-source';
import type {
  MountId,
  PrComment,
  ResolveAttempt,
  ResolveQueueItemWithThread,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { mountReviewGithub } from '../../../review/mountReviewGithub';
import { groupThreads } from '../../../integrations/github/comment-threads';
import type { DiffThread, DiffThreadHost } from '../../components/DiffView/types';
import { replyOnHostThread, resolveHostThread } from '../../lib/hostThreadVerbs';
import { buildResolveQueueRows } from '../../../resolve/buildResolveQueueRows';
import { hostThreadStatusOf } from '../../lib/hostThreadStatusOf';
import { useHostSource } from '../useHostSource';
import { hostDiffThreadId, hostThreadIdOf } from '../../lib/threadIds';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

export type DiffReviewThreads = {
  readonly threads: ReadonlyArray<DiffThread>;
  readonly onReply: (id: string, body: string) => Promise<void>;
  readonly onResolve: (id: string) => Promise<void>;
  readonly onOpenInComments: (id: string) => void;
};

const NO_COMMENTS: ReadonlyArray<PrComment> = [];
const NO_THREADS: ReadonlyArray<DiffThread> = [];
const NO_ITEMS: ReadonlyArray<ResolveQueueItemWithThread> = [];
const NO_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];

export const useDiffReviewThreads = ({ sessionId, mountId }: Params): DiffReviewThreads => {
  const github = useAppStore((s) =>
    mountId === null ? null : mountReviewGithub({ state: s, sessionId, mountId }),
  );
  const source = useHostSource({ sessionId, mountId });
  const openReviewTarget = useAppStore((s) => s.openReviewTarget);
  const hasMountRequest = useAppStore((s) =>
    mountId === null ? false : s.mountGithub[mountId]?.pr != null,
  );
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const refreshReviewSource = useAppStore((s) => s.refreshReviewSource);
  const queueItems = useAppStore((s) => s.sessionResolveQueueItems[sessionId] ?? NO_ITEMS);
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? NO_ATTEMPTS);

  const otherHost =
    source !== null &&
    source.kind !== 'github' &&
    (mountId === null || source.mountId === null || source.mountId === mountId)
      ? source
      : null;
  const host: DiffThreadHost | null =
    otherHost === null ? (github?.pr == null ? null : 'github') : otherHost.kind;
  const prNumber = otherHost === null ? (github?.pr?.number ?? null) : otherHost.prNumber;
  const comments =
    otherHost === null ? (github?.detail?.comments ?? NO_COMMENTS) : otherHost.comments;

  const hasThreads = otherHost === null ? github?.detail != null : otherHost.hasDetail;
  const isOtherHost = otherHost !== null;
  useEffect(() => {
    if (mountId === null || hasThreads) {
      return;
    }
    if (isOtherHost) {
      void refreshReviewSource({ sessionId, silent: true });
      return;
    }
    if (hasMountRequest) {
      void refreshSessionPrDetail(sessionId, { mountId, silent: true });
    }
  }, [
    hasMountRequest,
    hasThreads,
    isOtherHost,
    mountId,
    refreshReviewSource,
    refreshSessionPrDetail,
    sessionId,
  ]);

  const hostRows = useMemo(
    () =>
      new Map(
        buildResolveQueueRows({
          entries: queueItems.filter((entry) => entry.thread.originKind !== 'diff_comment'),
          attempts,
          deliveryReceipts: [],
          comments,
        }).map((row) => [row.thread.threadId, row] as const),
      ),
    [attempts, comments, queueItems],
  );

  const threads = useMemo(() => {
    if (host === null || prNumber === null) {
      return NO_THREADS;
    }
    const capabilities = REVIEW_SOURCE_CAPABILITIES[host];
    return groupThreads(comments).flatMap((thread): ReadonlyArray<DiffThread> => {
      const { head } = thread;
      if (head.source !== 'review' || head.threadId == null || head.path === undefined) {
        return [];
      }
      const row = hostRows.get(head.threadId) ?? null;
      const status = hostThreadStatusOf({
        row,
        isResolved: head.resolved === true,
        isOutdated: head.outdated === true,
      });
      return [
        {
          id: hostDiffThreadId({ threadId: head.threadId }),
          filePath: head.path,
          anchor: head.line === undefined ? null : { side: 'new', lineNumber: head.line },
          body: head.body,
          tone: status.tone,
          author: head.author,
          authorAvatarUrl: head.authorAvatarUrl,
          isAgent: false,
          source: 'host',
          host,
          createdAt: head.createdAt,
          statusLabel: status.label,
          isResolved: status.isDone,
          isOutdated: head.outdated === true,
          ...(row !== null && { fixTarget: { sessionId, threadId: head.threadId } }),
          replies: thread.replies.map((reply) => ({
            id: reply.id,
            author: reply.author,
            body: reply.body,
          })),
          canReply: capabilities.canReply,
          canResolve: head.canResolve ?? capabilities.canResolve,
          canEdit: false,
          canClose: false,
          canReopen: false,
          canDelete: false,
        },
      ];
    });
  }, [comments, host, hostRows, prNumber, sessionId]);

  const onReply = useCallback(
    (id: string, body: string) =>
      replyOnHostThread({ getState: useAppStore.getState, sessionId, id, body }),
    [sessionId],
  );
  const onResolve = useCallback(
    (id: string) => resolveHostThread({ getState: useAppStore.getState, sessionId, id }),
    [sessionId],
  );
  const onOpenInComments = useCallback(
    (id: string) => {
      if (prNumber === null) {
        return;
      }
      void openReviewTarget({
        sessionId,
        destination: { kind: 'thread', mountId, prNumber, threadId: hostThreadIdOf({ id }) },
      });
    },
    [mountId, openReviewTarget, prNumber, sessionId],
  );

  return useMemo(
    () => ({ threads, onReply, onResolve, onOpenInComments }),
    [onOpenInComments, onReply, onResolve, threads],
  );
};
