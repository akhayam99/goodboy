import { CopyButton, Markdown } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { extractAllCommentResolved, isReviewThreadId, stripControlMarkers } from '@goodboy/core';
import { ClustersCard } from '../ClustersCard';
import { HandoffChip } from '../HandoffChip';
import { PlanChip } from '../PlanChip';
import { ResolverThreadsCard } from '../ResolverThreadsCard';

type Props = {
  text: string;
  sessionId: SessionId | null;
  agentId?: AgentId | null;
};

export const AssistantText = ({ text, sessionId, agentId = null }: Props) => {
  const displayText = stripControlMarkers(text);
  const hasCommentResolvedMarker = extractAllCommentResolved(text).some(({ threadId }) =>
    isReviewThreadId(threadId),
  );
  return (
    <div className="group relative flex flex-col gap-2 text-sm leading-relaxed">
      {hasCommentResolvedMarker ? null : (
        <div className="absolute -right-1 -top-1 opacity-0 motion-safe:transition-opacity group-hover:opacity-100">
          <CopyButton value={text} label="message" />
        </div>
      )}
      {displayText.length > 0 ? <Markdown text={displayText} /> : null}
      {sessionId ? (
        <div className="flex flex-col items-start gap-2 empty:hidden">
          <PlanChip assistantText={text} sessionId={sessionId} />
          <ClustersCard assistantText={text} sessionId={sessionId} />
          <HandoffChip assistantText={text} sessionId={sessionId} />
          <ResolverThreadsCard assistantText={text} sessionId={sessionId} agentId={agentId} />
        </div>
      ) : null}
    </div>
  );
};
