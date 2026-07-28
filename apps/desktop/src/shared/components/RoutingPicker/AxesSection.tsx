import type { EffortLevel, ModelAxes } from '@goodboy/types';
import { EFFORT_LABEL } from '../../../features/chat/utils/chat-constants';
import { AxisRow } from './AxisRow';
import { EffortChips } from './EffortChips';
import { PickerChip } from './PickerChip';

type Props = {
  readonly axes: ModelAxes;
  readonly effortValue: EffortLevel;
  readonly canEditEffort: boolean;
  readonly notice?: {
    readonly requested: EffortLevel;
    readonly applied: EffortLevel;
  };
  readonly hasMaxModeAdvisory: boolean;
  readonly onEffort: (level: EffortLevel) => void;
  readonly onVariant: (id: string) => void;
  readonly onToggle: (id: 'thinking' | 'fast') => void;
};

export const AxesSection = ({
  axes,
  effortValue,
  canEditEffort,
  notice,
  hasMaxModeAdvisory,
  onEffort,
  onVariant,
  onToggle,
}: Props) => {
  const hasNoAxes = axes.effort == null && axes.variant == null && axes.toggles.length === 0;
  return (
    <section aria-label="Tuning" className="flex flex-col gap-2.5 p-3">
      {hasNoAxes && (
        <p className="text-xs text-muted-foreground">No tuning options for this provider</p>
      )}
      {axes.variant != null && (
        <AxisRow label={axes.variant.label}>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-background/40 p-1">
            {axes.variant.options.map((option) => (
              <PickerChip
                key={option.id}
                label={option.label}
                active={option.id === axes.variant?.activeId}
                onSelect={() => onVariant(option.id)}
              />
            ))}
          </div>
        </AxisRow>
      )}
      {axes.effort != null && (
        <AxisRow label={axes.effort.label}>
          <EffortChips
            axis={axes.effort}
            value={effortValue}
            canEdit={canEditEffort}
            onPick={onEffort}
          />
        </AxisRow>
      )}
      {axes.toggles.map((toggle) => (
        <AxisRow key={toggle.id} label={toggle.label}>
          <PickerChip
            label={toggle.label}
            active={toggle.active}
            disabled={toggle.canToggle === false}
            title={
              toggle.canToggle === false
                ? `${toggle.label} cannot be changed for this model`
                : undefined
            }
            onSelect={() => onToggle(toggle.id)}
          />
        </AxisRow>
      ))}
      {axes.requiresMaxMode && (
        <p role="status" aria-label="Max Mode required" className="text-2xs text-warning">
          Requires Max Mode. Goodboy cannot enable it. Turn it on in the Cursor app.
        </p>
      )}
      {hasMaxModeAdvisory && axes.requiresMaxMode === false && (
        <p
          role="status"
          aria-label="Max Mode required previously"
          className="text-2xs text-warning"
        >
          This model previously required Max Mode. Goodboy cannot enable it. Turn it on in the
          Cursor app, then retry.
        </p>
      )}
      {notice != null && (
        <p role="status" className="text-2xs text-warning">
          Effort adjusted from {EFFORT_LABEL[notice.requested]} to {EFFORT_LABEL[notice.applied]}.
        </p>
      )}
    </section>
  );
};
