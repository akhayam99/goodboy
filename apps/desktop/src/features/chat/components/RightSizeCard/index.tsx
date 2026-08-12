import { cn } from '@goodboy/ui';
import { modelLabel, modelTier, TIER_TEXT } from '../../utils/chat-constants';
import { NudgeCard } from '../NudgeCard';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

export type Props = {
  readonly direction: 'lighter' | 'heavier';
  readonly kind: 'strong' | 'optional';
  readonly costMultiplier: number | null;
  readonly currentModel: string;
  readonly suggestedModel: string;
  readonly onUseSuggested: () => void;
  readonly onKeepCurrent: () => void;
  readonly onChangeModel: () => void;
};

const lead = (direction: Props['direction'], kind: Props['kind']): string => {
  if (direction === 'lighter') {
    return 'This looks light.';
  }
  return kind === 'optional' ? 'This might run heavy.' : 'This looks heavy.';
};

const costLine = (
  direction: Props['direction'],
  kind: Props['kind'],
  costMultiplier: number | null,
): string | null => {
  if (direction === 'lighter') {
    return costMultiplier !== null ? `About ${costMultiplier}x cheaper.` : null;
  }
  if (kind === 'optional') {
    return costMultiplier !== null ? `Optional, about ${costMultiplier}x cost.` : 'Optional.';
  }
  return 'Current model looks underpowered for this.';
};

export const RightSizeCard = ({
  direction,
  kind,
  costMultiplier,
  currentModel,
  suggestedModel,
  onUseSuggested,
  onKeepCurrent,
  onChangeModel,
}: Props) => {
  const body = costLine(direction, kind, costMultiplier);
  return (
    <NudgeCard
      severity="info"
      icon={<CONCEPT_ICONS.suggestion size={12} aria-hidden />}
      ariaLabel="Model right-sizing suggestion"
      testId="right-size-card"
      autoFocusPrimary
      title={
        <>
          {lead(direction, kind)} Run with{' '}
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
      body={body ? <span data-testid="right-size-cost-line">{body}</span> : undefined}
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
};
