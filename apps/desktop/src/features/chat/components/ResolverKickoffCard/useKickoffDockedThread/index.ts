import { useMemo } from 'react';
import type { PrComment, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { groupThreads, type CommentThread } from '../../../../github/comment-threads';

type Params = {
  readonly sessionId: SessionId | null;
  readonly threadId: string | null;
};

export const useKickoffDockedThread = ({ sessionId, threadId }: Params): CommentThread | null => {
  const comments = useAppStore((state) =>
    sessionId === null
      ? (EMPTY_ARRAY as ReadonlyArray<PrComment>)
      : (state.sessionGithub[sessionId]?.detail?.comments ??
        (EMPTY_ARRAY as ReadonlyArray<PrComment>)),
  );

  return useMemo(() => {
    if (threadId === null) {
      return null;
    }
    const match = groupThreads(comments).find(
      ({ head }) => head.source === 'review' && head.threadId === threadId,
    );
    return match ?? null;
  }, [comments, threadId]);
};
