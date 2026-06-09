import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { modelLabel, modelTier, TIER_TEXT } from '../../utils/chat-constants';
import { NudgeCard } from '../NudgeCard';

export interface Props {
  readonly direction: 'lighter' | 'heavier';
  readonly currentModel: string;
  readonly suggestedModel: string;
  readonly onUseSuggested: () => void;
  readonly onKeepCurrent: () => void;
  readonly onChangeModel: () => void;
}

export function RightSizeCard({
  direction,
  currentModel,
  suggestedModel,
  onUseSuggested,
  onKeepCurrent,
  onChangeModel,
}: Props) {
  return (
    <NudgeCard
      severity="info"
      icon={<Sparkles size={12} aria-hidden />}
      ariaLabel="model right-sizing suggestion"
      testId="right-size-card"
      autoFocusPrimary
      title={
        <>
          {direction === 'lighter' ? 'This looks light.' : 'This looks heavy.'} Run with{' '}
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
