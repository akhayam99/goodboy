import { useMemo } from 'react';
import { CopyButton, Markdown } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { extractAllCommentResolved, isReviewThreadId, stripControlMarkers } from '@goodboy/core';
import { HandoffChip } from '../HandoffChip';
import { PlanChip } from '../PlanChip';
import { ResolverThreadsCard } from '../ResolverThreadsCard';
import { ScribeTextCard } from '../ScribeTextCard';
import { carriesPullRequestText } from '../../../../shared/utils/scribeProposal';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { useRevealedMarkdown } from '../../reveal/useRevealedMarkdown';

type Props = {
  text: string;
  sessionId: SessionId | null;
  agentId?: AgentId | null;
  runId?: string | null;
  itemKey?: string;
  isComplete?: boolean;
};

const NO_RUN = '';

export const AssistantText = ({
  text,
  sessionId,
  agentId = null,
  runId = null,
  itemKey = '',
  isComplete = true,
}: Props) => {
  const displayText = stripControlMarkers(text);
  const reveal = useRevealedMarkdown({
    runId: runId ?? NO_RUN,
    itemKey,
    text: displayText,
    isComplete,
  });
  const hasScribeText = useMemo(() => carriesPullRequestText({ text }), [text]);
  const hasCommentResolvedMarker = extractAllCommentResolved(text).some(({ threadId }) =>
    isReviewThreadId(threadId),
  );
  const menu = useObjectMenuTrigger({
    target: { kind: 'message', text: displayText, sessionId, agentId },
    anchorKey: null,
  });
  return (
    <div
      ref={reveal.rootRef}
      className="flex flex-col gap-2 text-prose"
      aria-busy={reveal.isRevealing ? true : undefined}
      data-reveal-answer={reveal.isRevealing ? reveal.revealKey : undefined}
      onContextMenu={menu.onContextMenu}
    >
      {reveal.text.length > 0 ? <Markdown text={reveal.text} fresh={reveal.fresh} /> : null}
      {reveal.isRevealing ? null : (
        <>
          {sessionId && agentId && hasScribeText ? (
            <ScribeTextCard assistantText={text} sessionId={sessionId} agentId={agentId} />
          ) : null}
          {sessionId ? (
            <div className="flex flex-col items-start gap-2 empty:hidden">
              <PlanChip assistantText={text} sessionId={sessionId} />
              <HandoffChip assistantText={text} sessionId={sessionId} sourceAgentId={agentId} />
              <ResolverThreadsCard assistantText={text} sessionId={sessionId} agentId={agentId} />
            </div>
          ) : null}
          {hasCommentResolvedMarker || displayText.length === 0 ? null : (
            <div data-message-meta="" className="flex items-center justify-end">
              <CopyButton
                presentation="icon"
                value={text}
                label="copy message"
                className="rounded-md p-0.5 text-muted-foreground transition-opacity hover:opacity-80 hover:text-foreground"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
