import { Sparkles } from 'lucide-react';
import { cn } from '@kay-am/ui';
import { modelLabel, modelTier, TIER_TEXT } from '../../utils/chat-constants';
import { NudgeCard } from '../NudgeCard';

export interface RightSizeCardProps {
  readonly currentModel: string;
  readonly suggestedModel: string;
  readonly onUseSuggested: () => void;
  readonly onKeepCurrent: () => void;
  readonly onChangeModel: () => void;
}

export function RightSizeCard({
  currentModel,
  suggestedModel,
  onUseSuggested,
  onKeepCurrent,
  onChangeModel,
}: RightSizeCardProps) {
  return (
    <NudgeCard
      severity="info"
      icon={<Sparkles size={12} aria-hidden />}
      ariaLabel="model right-sizing suggestion"
      testId="right-size-card"
      autoFocusPrimary
      title={
        <>
          This looks light. Run with{' '}
          <span className={cn('font-semibold', TIER_TEXT[modelTier(suggestedModel)])}>
            {modelLabel(suggestedModel)}
          </span>{' '}
          instead of{' '}
          <span className={cn('font-semibold', TIER_TEXT[modelTier(currentModel)])}>
            {modelLabel(currentModel)}
          </span>
          ?
        </>
      }
      primary={{
        label: `Use ${modelLabel(suggestedModel)}`,
        onClick: onUseSuggested,
        testId: 'right-size-use-suggested',
      }}
      secondary={{
        label: `Keep ${modelLabel(currentModel)}`,
        onClick: onKeepCurrent,
        testId: 'right-size-keep-current',
      }}
      tertiary={{
        label: 'Change model…',
        onClick: onChangeModel,
        testId: 'right-size-change-model',
      }}
    />
  );
}
