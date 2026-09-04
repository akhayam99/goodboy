import type { PendingResolution } from '@goodboy/types';
import type { SessionGithubState } from '../../store/types';
import { groupThreads, type CommentThread } from '../github/comment-threads';
import { resolverForComment, type ResolverIndex } from '../session/resolver-linkage';

type Params = {
  readonly github: SessionGithubState | null;
  readonly pendingResolutions: ReadonlyArray<PendingResolution>;
  readonly resolverIndex: ResolverIndex;
};

export const eligibleReviewThreads = ({
  github,
  pendingResolutions,
  resolverIndex,
}: Params): ReadonlyArray<CommentThread> => {
  const pendingThreadIds = new Set(pendingResolutions.map((resolution) => resolution.threadId));
  return groupThreads(github?.detail?.comments ?? []).filter((thread) => {
    if (thread.head.source !== 'review' || thread.head.resolved !== false) {
      return false;
    }
    if (thread.head.threadId != null && pendingThreadIds.has(thread.head.threadId)) {
      return false;
    }
    const resolver = resolverForComment(resolverIndex, {
      threadId: thread.head.threadId,
      url: thread.head.url,
    });
    return resolver == null || resolver.status === 'failed';
  });
};

export const eligibleReviewThreadCount = (params: Params): number =>
  eligibleReviewThreads(params).length;
