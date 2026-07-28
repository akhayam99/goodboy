import type { ModelSelection, ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from '@goodboy/core';
import { VariantChip } from './VariantChip';

type Props = {
  readonly provider?: ProviderId;
  readonly id: string;
  readonly active: boolean;
  readonly selection?: ModelSelection;
  readonly onSelect: () => void;
  readonly onSelection?: (selection: ModelSelection) => void;
};

export const ModelChip = ({ provider, id, active, selection, onSelect, onSelection }: Props) => {
  const model =
    provider == null ? null : MODEL_CATALOGS[provider].find((entry) => entry.key === id);
  const variants = model?.provider === 'codex' ? model.variants : [];
  return (
    <span className="inline-flex items-center gap-1">
      <VariantChip id={id} active={active} onSelect={onSelect} />
      {variants.length > 1 && (
        <select
          aria-label={`${model?.label ?? id} variant`}
          value={active ? (selection?.variant ?? variants[0]?.id) : variants[0]?.id}
          onChange={(event) => {
            onSelection?.({
              key: id,
              ...(selection?.effort != null && { effort: selection.effort }),
              variant: event.target.value,
            });
          }}
          className="h-6 rounded-md border border-border-soft bg-background px-1 text-2xs text-muted-foreground"
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.label}
            </option>
          ))}
        </select>
      )}
    </span>
  );
};
