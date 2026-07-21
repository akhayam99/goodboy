import { cn } from '@goodboy/ui';
import { TIER_TEXT, type ModelFamily, modelTier, parseModelId } from '../../utils/chat-constants';

type Props = {
  readonly family: ModelFamily;
  readonly ids: string[];
  readonly selectedModel: string;
  readonly onSelect: (id: string) => void;
};

const CHIP_ROW = 'flex flex-wrap gap-1 px-2.5 pb-2' as const;
const CHIP_INACTIVE = 'text-muted-foreground hover:bg-muted hover:text-foreground' as const;

export const FlatVariantRow = ({ family: _family, ids, selectedModel, onSelect }: Props) => (
  <div className={CHIP_ROW}>
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
            'rounded-full px-2.5 py-0.5 text-xs transition-colors',
            selected ? cn('bg-muted font-semibold', TIER_TEXT[t]) : CHIP_INACTIVE,
          )}
        >
          {chip}
        </button>
      );
    })}
  </div>
);
