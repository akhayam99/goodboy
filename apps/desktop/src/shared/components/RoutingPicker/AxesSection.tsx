import type { EffortLevel, ModelAxes, ModelKey } from '@goodboy/types';
import { EFFORT_LABEL } from '../../../features/chat/utils/chat-constants';
import { toggleTone } from './chipTone';
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
  readonly onModel: (modelKey: ModelKey) => void;
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
  onModel,
  onVariant,
  onToggle,
}: Props) => {
  const toggleRowLabel = 'Modes';
  const selectionAxes = axes.version == null ? [axes.model] : [axes.model, axes.version];
  const variantAxis = axes.variant;
  return (
    <section aria-label="Model options" className="flex flex-col gap-2.5 p-3">
      {selectionAxes.map((axis) => (
        <AxisRow key={axis.label} label={axis.label}>
          <div
            role="group"
            aria-label={axis.label}
            className="flex flex-wrap justify-end gap-1 rounded-lg bg-background/40 p-1"
          >
            {axis.options.map((option) => (
              <PickerChip
                key={option.id}
                label={option.label}
                active={option.id === axis.activeId}
                onSelect={() => onModel(option.modelKey)}
              />
            ))}
          </div>
        </AxisRow>
      ))}
      {variantAxis != null && (
        <AxisRow label={variantAxis.label}>
          <div
            role="group"
            aria-label={variantAxis.label}
            className="flex flex-wrap justify-end gap-1 rounded-lg bg-background/40 p-1"
          >
            {variantAxis.options.map((option) => (
              <PickerChip
                key={option.id}
                label={option.label}
                active={option.id === variantAxis.activeId}
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
      {axes.toggles.length > 0 && (
        <AxisRow label={toggleRowLabel}>
          <div
            role="group"
            aria-label={toggleRowLabel}
            className="flex flex-wrap justify-end gap-1 rounded-lg bg-background/40 p-1"
          >
            {axes.toggles.map((toggle) => (
              <PickerChip
                key={toggle.id}
                label={toggle.label}
                active={toggle.active}
                tone={toggleTone(toggle.id)}
                disabled={toggle.canToggle === false}
                title={
                  toggle.canToggle === false
                    ? `${toggle.label} cannot be changed for this model`
                    : undefined
                }
                onSelect={() => onToggle(toggle.id)}
              />
            ))}
          </div>
        </AxisRow>
      )}
      {axes.requiresMaxMode && (
        <p role="status" aria-label="Max Mode" className="text-2xs text-warning">
          Runs in Max Mode. Cursor bills Max Mode requests at a higher rate.
        </p>
      )}
      {hasMaxModeAdvisory && axes.requiresMaxMode === false && (
        <p role="status" aria-label="Max Mode rejected" className="text-2xs text-warning">
          Cursor rejected Max Mode for this model. Check that Max Mode is available on your account,
          then retry.
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
