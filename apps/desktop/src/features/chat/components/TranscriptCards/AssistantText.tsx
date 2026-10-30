import { useMemo } from 'react';
import { CopyButton } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import {
  extractAllCommentResolved,
  isReviewThreadId,
  parseOutcomeLine,
  stripControlMarkers,
} from '@goodboy/core';
import { HandoffChip } from '../HandoffChip';
import { PlanChip } from '../PlanChip';
import { ResolverThreadsCard } from '../ResolverThreadsCard';
import { ScribeTextCard } from '../ScribeTextCard';
import { carriesPullRequestText } from '../../../../shared/utils/scribeProposal';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { useRevealedMarkdown } from '../../reveal/useRevealedMarkdown';
import { ReadingOrderMessage } from '../../readingOrder/ReadingOrderMessage';
import { READING_BUDGETS } from '../../readingOrder/readingBudgets';

type Props = {
  clampLines?: number;
  text: string;
  sessionId: SessionId | null;
  agentId?: AgentId | null;
  runId?: string | null;
  itemKey?: string;
  isComplete?: boolean;
  workingDir?: string | null;
};

const NO_RUN = '';

export const AssistantText = ({
  clampLines = READING_BUDGETS.answerClampLines,
  text,
  sessionId,
  agentId = null,
  runId = null,
  itemKey = '',
  isComplete = true,
  workingDir = null,
}: Props) => {
  const displayText = stripControlMarkers(text);
  const outcomeText = parseOutcomeLine({ text });
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
  const codeTarget = useMemo(() => ({ sessionId, workingDir }), [sessionId, workingDir]);
  const menu = useObjectMenuTrigger({
    target: { kind: 'message', text: displayText, sessionId, agentId },
    anchorKey: null,
  });
  return (
    <div
      ref={reveal.rootRef}
      className="group/row relative flex flex-col gap-2 text-prose"
      aria-busy={reveal.isRevealing ? true : undefined}
      data-reveal-answer={reveal.isRevealing ? reveal.revealKey : undefined}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
    >
      <ReadingOrderMessage
        text={reveal.text}
        fresh={reveal.fresh}
        codeTarget={codeTarget}
        clampLines={reveal.isRevealing || !isComplete ? null : clampLines}
        outcome={
          outcomeText === null || reveal.isRevealing || !isComplete
            ? null
            : { text: outcomeText, tone: 'neutral' }
        }
      >
        {reveal.isRevealing ? null : sessionId && agentId && hasScribeText ? (
          <ScribeTextCard
            assistantText={text}
            sessionId={sessionId}
            agentId={agentId}
            runId={runId}
          />
        ) : null}
        {reveal.isRevealing || !sessionId ? null : (
          <div className="flex flex-col items-start gap-2 empty:hidden">
            <PlanChip assistantText={text} sessionId={sessionId} />
            <HandoffChip assistantText={text} sessionId={sessionId} sourceAgentId={agentId} />
            <ResolverThreadsCard
              assistantText={text}
              sessionId={sessionId}
              agentId={agentId}
              runId={runId}
            />
          </div>
        )}
      </ReadingOrderMessage>
      {reveal.isRevealing || hasCommentResolvedMarker || displayText.length === 0 ? null : (
        <div
          data-message-meta=""
          className="row-actions absolute top-0 -right-8 @max-[800px]:right-0"
        >
          <CopyButton
            presentation="icon"
            value={text}
            label="copy message"
            tone="faint"
            className="rounded-md p-0.5"
          />
        </div>
      )}
    </div>
  );
};
