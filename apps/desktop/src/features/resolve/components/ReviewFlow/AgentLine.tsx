import { useMemo } from 'react';
import { stripControlMarkers } from '@goodboy/core';
import { WorkNode, cn } from '@goodboy/ui';
import type { ResolveAttempt } from '@goodboy/types';
import { useTranscript } from '../../../../store/slices/transcripts/selectors';
import { reduceTranscript } from '../../../chat/utils/transcript-items';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { REVIEW_COMMENT_NODE, type ReviewCommentState } from '../../reviewCommentState';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';
import { STATE_WORD_TONE } from './stateTone';

type Props = {
  readonly attempt: ResolveAttempt;
  readonly state: ReviewCommentState;
  readonly word: string;
};

const lastLineOf = ({ text }: { readonly text: string }): string =>
  stripControlMarkers(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .at(-1) ?? '';

export const AgentLine = ({ attempt, state, word }: Props) => {
  const transcript = useTranscript(attempt.agentId);
  const isDrafting = state === 'drafting';
  const live = useMemo(() => {
    if (!isDrafting) {
      return '';
    }
    const items = reduceTranscript(transcript);
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item?.kind === 'assistant_text') {
        return lastLineOf({ text: item.text });
      }
    }
    return '';
  }, [isDrafting, transcript]);
  const at = attempt.endedAt ?? attempt.startedAt ?? attempt.createdAt;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="flex min-w-0 items-center gap-2 text-label">
        <WorkNode state={REVIEW_COMMENT_NODE[state]} label={word} mark={{ kind: 'dot' }} />
        <span className="shrink-0 text-foreground">{REVIEW_FLOW_LABEL.resolver}</span>
        <span className="min-w-0 truncate text-muted-foreground">
          {modelLabel(attempt.model)} · {formatRelativeAge({ fromIso: new Date(at).toISOString() })}
        </span>
        <span className={cn('shrink-0', STATE_WORD_TONE[state])}>{word}</span>
      </p>
      {live !== '' && (
        <p
          aria-live="polite"
          className="min-w-0 truncate pl-7 text-secondary text-muted-foreground motion-safe:animate-studio-in"
        >
          {live}
        </p>
      )}
    </div>
  );
};
