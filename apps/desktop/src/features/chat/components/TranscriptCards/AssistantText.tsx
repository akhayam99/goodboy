import { CopyButton, Markdown } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { extractCommentResolved, isReviewThreadId, stripControlMarkers } from '@goodboy/core';
import { ClustersCard } from '../ClustersCard';
import { CommentAnalysisChip } from '../CommentAnalysisChip';
import { CommentResolvedChip } from '../CommentResolvedChip';
import { CommentWontfixChip } from '../CommentWontfixChip';
import { HandoffChip } from '../HandoffChip';
import { PlanChip } from '../PlanChip';
import { TranscriptShell } from '../TranscriptShell';

type Props = {
  text: string;
  sessionId: SessionId | null;
  agentId?: AgentId | null;
};

export const AssistantText = ({ text, sessionId, agentId = null }: Props) => {
  const displayText = stripControlMarkers(text);
  const resolvedMarker = extractCommentResolved(text);
  const hasCommentResolvedMarker =
    resolvedMarker !== null && isReviewThreadId(resolvedMarker.threadId);
  return (
    <TranscriptShell tone="neutral" variant="boxed" className="group relative text-sm">
      {hasCommentResolvedMarker ? null : (
        <div className="absolute -right-1 -top-1 opacity-0 motion-safe:transition-opacity group-hover:opacity-100">
          <CopyButton value={text} label="message" />
        </div>
      )}
      {displayText.length > 0 ? <Markdown text={displayText} /> : null}
      {sessionId ? (
        <div className="flex flex-col items-start gap-2 empty:hidden [&:not(:empty)]:mt-2">
          <PlanChip assistantText={text} sessionId={sessionId} />
          <ClustersCard assistantText={text} sessionId={sessionId} />
          <HandoffChip assistantText={text} sessionId={sessionId} />
          <CommentAnalysisChip assistantText={text} sessionId={sessionId} agentId={agentId} />
          <CommentResolvedChip assistantText={text} sessionId={sessionId} agentId={agentId} />
          <CommentWontfixChip assistantText={text} sessionId={sessionId} />
        </div>
      ) : null}
    </TranscriptShell>
  );
};
