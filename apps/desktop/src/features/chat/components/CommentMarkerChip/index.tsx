import { useMemo } from 'react';
import { extractAllCommentReplies } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import { CommentMarkerChipItem } from './CommentMarkerChipItem';
import type { CommentMarker } from './commentMarker';
import { extractCommentMarkers } from './extractCommentMarkers';

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
  readonly agentId?: AgentId | null;
  readonly kind: CommentMarker['kind'];
};

export const CommentMarkerChip = ({ assistantText, sessionId, agentId = null, kind }: Props) => {
  const markers = useMemo(
    () => extractCommentMarkers({ assistantText, kind }),
    [assistantText, kind],
  );
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
        <CommentMarkerChipItem
          key={`${marker.value.threadId}:${index}`}
          marker={marker}
          reply={replies.get(marker.value.threadId) ?? null}
          sessionId={sessionId}
          agentId={agentId}
        />
      ))}
    </>
  );
};
