import { useMemo } from 'react';
import { extractAllCommentAnalysis, extractAllCommentReplies } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import { CommentAnalysisChipItem } from './CommentAnalysisChipItem';

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
  readonly agentId?: AgentId | null;
};

export const CommentAnalysisChip = ({ assistantText, sessionId, agentId = null }: Props) => {
  const markers = useMemo(() => extractAllCommentAnalysis(assistantText), [assistantText]);
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
        <CommentAnalysisChipItem
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
