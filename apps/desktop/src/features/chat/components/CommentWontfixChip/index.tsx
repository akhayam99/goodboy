import { useMemo } from 'react';
import { extractAllCommentReplies, extractAllCommentWontfix } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import { CommentWontfixChipItem } from './CommentWontfixChipItem';

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
  readonly agentId?: AgentId | null;
};

export const CommentWontfixChip = ({ assistantText, sessionId, agentId = null }: Props) => {
  const markers = useMemo(() => extractAllCommentWontfix(assistantText), [assistantText]);
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
        <CommentWontfixChipItem
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
