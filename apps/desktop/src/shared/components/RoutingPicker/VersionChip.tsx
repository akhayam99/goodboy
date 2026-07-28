import { cn } from '@goodboy/ui';
import type { CatalogModel, ModelCostTier } from '@goodboy/types';

type Props = {
  readonly model: CatalogModel;
  readonly active: boolean;
  readonly isRecommended: boolean;
  readonly hasMaxModeAdvisory: boolean;
  readonly onSelect: () => void;
};

type TierClassName = {
  readonly active: string;
  readonly inactive: string;
};

const TIER_NOTE: Record<ModelCostTier, string> = {
  cheap: 'cheap',
  mid: 'standard',
  expensive: 'premium',
};

const TIER_CLASS_NAME: Record<ModelCostTier, TierClassName> = {
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

export const VersionChip = ({
  model,
  active,
  isRecommended,
  hasMaxModeAdvisory,
  onSelect,
}: Props) => {
  const tier = model.presentation.costTier;
  const alwaysRequiresMaxMode =
    model.provider === 'cursor' && model.combos.every((combo) => combo.maxMode);
  const showMaxModeWarning = alwaysRequiresMaxMode || hasMaxModeAdvisory;
  const accessibleName = `${model.label}${isRecommended ? ', Recommended' : ''}`;
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${model.label} (${TIER_NOTE[tier]})`}
      aria-label={accessibleName}
      aria-pressed={active}
      className={cn(
        'relative inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-2xs transition-colors',
        active ? TIER_CLASS_NAME[tier].active : TIER_CLASS_NAME[tier].inactive,
        active && 'font-medium',
        isRecommended && 'ring-1 ring-primary/40',
      )}
    >
      {model.presentation.version}
      {showMaxModeWarning && (
        <span
          title="May require Max Mode in the Cursor app"
          className="absolute right-0 top-0 size-1.5 rounded-full bg-warning ring-1 ring-subtle"
        />
      )}
    </button>
  );
};
