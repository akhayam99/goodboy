import { useMemo } from 'react';
import { stripControlMarkers } from '@goodboy/core';
import { WorkNode, cn } from '@goodboy/ui';
import type { ResolveAttempt } from '@goodboy/types';
import { useTranscript } from '../../../../store/slices/transcripts/selectors';
import { reduceTranscript } from '../../../chat/utils/transcript-items';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import { REVIEW_COMMENT_NODE, type ReviewCommentState } from '../../reviewCommentState';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';
import { STATE_WORD_TONE } from './stateTone';

type Props = {
  readonly attempt: ResolveAttempt;
  readonly state: ReviewCommentState;
  readonly word: string;
  readonly attemptNumber?: number | null;
};

const lastLineOf = ({ text }: { readonly text: string }): string =>
  stripControlMarkers(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .at(-1) ?? '';

export const AgentLine = ({ attempt, state, word, attemptNumber = null }: Props) => {
  const transcript = useTranscript(attempt.agentId);
  const now = useNow(30_000);
  const isDrafting = state === 'drafting';
  const isWaiting = isDrafting && attempt.phase === 'queued' && attempt.batchId !== null;
  const live = useMemo(() => {
    if (!isDrafting) {
      return '';
    }
    if (isWaiting) {
      return REVIEW_FLOW_LABEL.waitingForSlot;
    }
    const items = reduceTranscript(transcript);
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item?.kind === 'assistant_text') {
        return lastLineOf({ text: item.text });
      }
    }
    return '';
  }, [isDrafting, isWaiting, transcript]);
  const at = attempt.endedAt ?? attempt.startedAt ?? attempt.createdAt;
  const hasNumber = attemptNumber !== null;
  const duration =
    hasNumber && attempt.startedAt !== null && attempt.endedAt !== null
      ? formatDuration({ durationMs: attempt.endedAt - attempt.startedAt })
      : null;
  const meta = [
    modelLabel(attempt.model),
    ...(hasNumber && attempt.effort !== null
      ? [`${attempt.effort.charAt(0).toUpperCase()}${attempt.effort.slice(1)}`]
      : []),
    duration ?? formatAge({ from: at, now }),
  ];
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="flex min-w-0 items-center gap-2 text-label">
        <WorkNode state={REVIEW_COMMENT_NODE[state]} label={word} mark={{ kind: 'dot' }} />
        <span className="shrink-0 text-foreground">
          {hasNumber ? `Attempt ${attemptNumber}` : REVIEW_FLOW_LABEL.resolver}
        </span>
        <span className="min-w-0 truncate text-muted-foreground">{meta.join(' · ')}</span>
        <span className={cn('shrink-0', STATE_WORD_TONE[state])}>{word}</span>
      </p>
      {live !== '' && (
        <p
          aria-live="polite"
          className="min-w-0 truncate pl-7 text-meta text-muted-foreground motion-safe:animate-studio-in"
        >
          {live}
        </p>
      )}
    </div>
  );
};
