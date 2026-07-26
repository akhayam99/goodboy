import { cn } from '@goodboy/ui';
import {
  modelTier,
  parseModelId,
  type CostTier,
} from '../../../features/chat/utils/chat-constants';

type Props = {
  readonly id: string;
  readonly active: boolean;
  readonly onSelect: () => void;
};

const TIER_NOTE: Record<CostTier, string> = {
  cheap: 'cheap',
  mid: 'standard',
  expensive: 'premium',
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
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-2xs text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground',
        active && 'bg-background font-medium text-foreground shadow-sm',
      )}
    >
      {parseModelId(id).variantLabel}
      {tier === 'expensive' && <span className="text-muted-foreground/50">$$</span>}
    </button>
  );
};
