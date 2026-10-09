import { WorkNode, cn } from '@goodboy/ui';
import type { ResolveAttempt } from '@goodboy/types';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import { REVIEW_COMMENT_NODE, type ReviewCommentTone } from '../../reviewCommentState';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';
import { STATE_WORD_TONE } from './stateTone';

type Props = {
  readonly attempt: ResolveAttempt;
  readonly toneKey: ReviewCommentTone;
  readonly word: string;
  readonly attemptNumber?: number | null;
};

export const AgentLine = ({ attempt, toneKey, word, attemptNumber = null }: Props) => {
  const now = useNow(30_000);
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
    <p className="flex min-w-0 items-center gap-2 text-label">
      <WorkNode state={REVIEW_COMMENT_NODE[toneKey]} label={word} mark={{ kind: 'dot' }} />
      <span className="shrink-0 text-foreground">
        {hasNumber ? `Attempt ${attemptNumber}` : REVIEW_FLOW_LABEL.resolver}
      </span>
      <span className="min-w-0 truncate text-muted-foreground">{meta.join(' · ')}</span>
      <span className={cn('shrink-0', STATE_WORD_TONE[toneKey])}>{word}</span>
    </p>
  );
};
