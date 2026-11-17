import { Button, ICON_SIZE, Tooltip } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { ITEM_WORK_WORDS } from '../../live-state/itemWork/itemWorkWords';
import type { CheckRowAction } from '../checks/checkRowResultOf';

type Props = {
  readonly action: CheckRowAction | 'none' | null;
  readonly lock: string | null;
  readonly analyzeTooltip: string;
  readonly isAnalyzeStarting: boolean;
  readonly isFixStarting: boolean;
  readonly isPushing: boolean;
  readonly isReviewOpen: boolean;
  readonly onAnalyze: () => void;
  readonly onToggleReview: () => void;
  readonly onPush: () => void;
  readonly onRetryFix: () => void;
};

const ANALYZE_LABEL = {
  none: 'Analyze',
  analyzeAgain: ITEM_WORK_WORDS.verb.analyzeAgain,
  retryAnalysis: ITEM_WORK_WORDS.verb.retry,
} as const;

export const CheckResultAction = ({
  action,
  lock,
  analyzeTooltip,
  isAnalyzeStarting,
  isFixStarting,
  isPushing,
  isReviewOpen,
  onAnalyze,
  onToggleReview,
  onPush,
  onRetryFix,
}: Props) => {
  if (action === 'none' || action === 'analyzeAgain' || action === 'retryAnalysis') {
    const AgentsIcon = CONCEPT_ICONS.agents;
    return (
      <Tooltip content={lock ?? analyzeTooltip}>
        <Button
          variant="ghost"
          size="sm"
          isBusy={isAnalyzeStarting}
          disabled={lock !== null}
          onClick={onAnalyze}
        >
          <AgentsIcon size={ICON_SIZE.row} aria-hidden />
          {ANALYZE_LABEL[action]}
        </Button>
      </Tooltip>
    );
  }
  if (action === 'reviewFix') {
    return (
      <Button variant="secondary" size="sm" aria-expanded={isReviewOpen} onClick={onToggleReview}>
        {ITEM_WORK_WORDS.verb.reviewFix}
      </Button>
    );
  }
  if (action === 'push') {
    const PushIcon = CONCEPT_ICONS.push;
    return (
      <Button variant="secondary" size="sm" isBusy={isPushing} busyLabel="Pushing" onClick={onPush}>
        <PushIcon size={ICON_SIZE.row} aria-hidden />
        {ITEM_WORK_WORDS.verb.push}
      </Button>
    );
  }
  if (action === 'retryFix') {
    return (
      <Tooltip content={lock ?? 'Start a new Implementer on the same proposal'}>
        <Button
          variant="secondary"
          size="sm"
          isBusy={isFixStarting}
          disabled={lock !== null}
          onClick={onRetryFix}
        >
          {ITEM_WORK_WORDS.verb.retry}
        </Button>
      </Tooltip>
    );
  }
  return null;
};
