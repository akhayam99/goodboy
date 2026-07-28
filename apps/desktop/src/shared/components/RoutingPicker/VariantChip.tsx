import { cn } from '@goodboy/ui';
import { modelLabel, modelTier, type CostTier } from '../../../features/chat/utils/chat-constants';

type Props = {
  readonly id: string;
  readonly active: boolean;
  readonly onSelect: () => void;
};

type TierClassName = {
  readonly active: string;
  readonly inactive: string;
};

const TIER_NOTE: Record<CostTier, string> = {
  cheap: 'cheap',
  mid: 'standard',
  expensive: 'premium',
};

const TIER_CLASS_NAME: Record<CostTier, TierClassName> = {
  cheap: {
    active: 'bg-success/20 text-success ring-1 ring-success/40',
    inactive: 'bg-success/10 text-success/70 hover:bg-success/15 hover:text-success',
  },
  mid: {
    active: 'bg-warning/20 text-warning ring-1 ring-warning/40',
    inactive: 'bg-warning/10 text-warning/70 hover:bg-warning/15 hover:text-warning',
  },
  expensive: {
    active: 'bg-danger/20 text-danger ring-1 ring-danger/40',
    inactive: 'bg-danger/10 text-danger/70 hover:bg-danger/15 hover:text-danger',
  },
};

export const VariantChip = ({ id, active, onSelect }: Props) => {
  const tier = modelTier(id);
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${id} (${TIER_NOTE[tier]})`}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-2xs transition-colors',
        active ? TIER_CLASS_NAME[tier].active : TIER_CLASS_NAME[tier].inactive,
        active && 'font-medium',
      )}
    >
      {modelLabel(id)}
    </button>
  );
};
