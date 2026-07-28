import { AlertTriangle, Check } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { CatalogModel } from '@goodboy/types';

type Props = {
  readonly model: CatalogModel;
  readonly active: boolean;
  readonly matchedVariant?: string;
  readonly hasMaxModeAdvisory: boolean;
  readonly isRecommended: boolean;
  readonly onSelect: () => void;
};

export const ModelRow = ({
  model,
  active,
  matchedVariant,
  hasMaxModeAdvisory,
  isRecommended,
  onSelect,
}: Props) => {
  const variantLabel =
    model.provider === 'codex'
      ? model.variants.find((variant) => variant.id === matchedVariant)?.label
      : undefined;
  const accessibleName = `${model.label}${variantLabel != null ? `, ${variantLabel}` : ''}${
    isRecommended ? ', Recommended' : ''
  }`;
  return (
    <button
      type="button"
      aria-label={accessibleName}
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{model.label}</span>
        {variantLabel != null && (
          <span className="text-2xs text-muted-foreground">Select {variantLabel}</span>
        )}
      </span>
      {hasMaxModeAdvisory && (
        <span
          role="status"
          aria-label="Max Mode required previously"
          title="This model previously required Max Mode. Goodboy cannot enable it. Turn it on in the Cursor app, then retry."
          className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-1.5 py-0.5 text-2xs font-medium text-warning"
        >
          <AlertTriangle size={10} aria-hidden />
          Max Mode
        </span>
      )}
      {isRecommended && (
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-2xs font-medium text-primary">
          Recommended
        </span>
      )}
      {active && <Check size={13} aria-hidden className="shrink-0 text-primary" />}
    </button>
  );
};
