import { useCallback, useMemo } from 'react';
import { REVIEW_SOURCE_CAPABILITIES } from '@goodboy/core';
import type { MountId, PrComment, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { mountReviewGithub } from '../../../review/mountReviewGithub';
import { groupThreads } from '../../../integrations/github/comment-threads';
import type { DiffThread, DiffThreadHost } from '../../components/DiffView/types';
import { replyOnHostThread, resolveHostThread } from '../../lib/hostThreadVerbs';
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

export const useDiffReviewThreads = ({ sessionId, mountId }: Params): DiffReviewThreads => {
  const github = useAppStore((s) =>
    mountId === null ? null : mountReviewGithub({ state: s, sessionId, mountId }),
  );
  const source = useHostSource({ sessionId });
  const openReviewTarget = useAppStore((s) => s.openReviewTarget);

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

  const threads = useMemo(() => {
    if (host === null || prNumber === null) {
      return NO_THREADS;
    }
    const capabilities = REVIEW_SOURCE_CAPABILITIES[host];
    return groupThreads(comments).flatMap((thread): ReadonlyArray<DiffThread> => {
      const { head } = thread;
      if (
        head.source !== 'review' ||
        head.threadId == null ||
        head.outdated === true ||
        head.path === undefined
      ) {
        return [];
      }
      const isResolved = head.resolved === true;
      return [
        {
          id: hostDiffThreadId({ threadId: head.threadId }),
          filePath: head.path,
          anchor: head.line === undefined ? null : { side: 'new', lineNumber: head.line },
          body: head.body,
          tone: 'neutral',
          author: head.author,
          authorAvatarUrl: head.authorAvatarUrl,
          isAgent: false,
          source: 'host',
          host,
          createdAt: head.createdAt,
          statusLabel: isResolved ? 'Resolved' : 'Open',
          isResolved,
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
  }, [comments, host, prNumber]);

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
