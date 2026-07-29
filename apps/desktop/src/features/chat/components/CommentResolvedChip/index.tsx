import { useMemo } from 'react';
import { extractAllCommentReplies, extractAllCommentResolved } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import { CommentResolvedChipItem } from './CommentResolvedChipItem';

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
  readonly agentId?: AgentId | null;
};

export const CommentResolvedChip = ({ assistantText, sessionId, agentId = null }: Props) => {
  const markers = useMemo(() => extractAllCommentResolved(assistantText), [assistantText]);
  const replies = useMemo(
    () =>
      new Map(
        extractAllCommentReplies(assistantText).map(({ threadId, body }) => [threadId, body]),
      ),
    [assistantText],
  );

  return (
    <>
      {markers.map((marker, index) => (
        <CommentResolvedChipItem
          key={`${marker.threadId}:${index}`}
          marker={marker}
          reply={replies.get(marker.threadId) ?? null}
          sessionId={sessionId}
          agentId={agentId}
        />
      ))}
    </>
  );
};
