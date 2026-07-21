import { cn } from '@goodboy/ui';
import {
  TIER_TEXT,
  type ModelFamily,
  modelTier,
  parseModelId,
  subfamilyLabel,
  subfamilyTier,
} from '../../utils/chat-constants';

type Props = {
  readonly family: ModelFamily;
  readonly subfamily: string;
  readonly ids: string[];
  readonly selectedModel: string;
  readonly onSelect: (id: string) => void;
};

const CHIP_INACTIVE = 'text-muted-foreground hover:bg-muted hover:text-foreground' as const;

export const SubfamilyVariantRow = ({ family, subfamily, ids, selectedModel, onSelect }: Props) => {
  const tier = subfamilyTier(family, subfamily);
  return (
    <div className="flex items-center px-2.5 py-1.5 hover:bg-muted/60">
      <span className={cn('flex-1 text-xs', TIER_TEXT[tier])}>
        {subfamilyLabel(family, subfamily)}
      </span>
      <div className="flex flex-wrap gap-1">
        {ids.map((id) => {
          const selected = selectedModel === id;
          const t = modelTier(id);
          const chip = parseModelId(id).variantLabel;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              title={id}
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-2xs transition-colors',
                selected ? cn('bg-muted font-semibold', TIER_TEXT[t]) : CHIP_INACTIVE,
              )}
            >
              {chip}
            </button>
          );
        })}
      </div>
    </div>
  );
};
