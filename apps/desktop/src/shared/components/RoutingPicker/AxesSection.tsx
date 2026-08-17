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
  return (
    <section aria-label="Model options" className="flex flex-col gap-2.5 p-3">
      {[axes.model, axes.version].map((axis) => (
        <AxisRow key={axis.label} label={axis.label}>
          <div
            role="group"
            aria-label={axis.label}
            className="flex flex-wrap justify-center gap-1 rounded-lg bg-background/40 p-1"
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
      <AxisRow label={axes.variant.label}>
        <div
          role="group"
          aria-label={axes.variant.label}
          className="flex flex-wrap justify-center gap-1 rounded-lg bg-background/40 p-1"
        >
          {axes.variant.options.length === 0 ? (
            <PickerChip label="Not available" active={false} disabled onSelect={() => undefined} />
          ) : (
            axes.variant.options.map((option) => {
              return (
                <PickerChip
                  key={option.id}
                  label={option.label}
                  active={option.id === axes.variant.activeId}
                  onSelect={() => onVariant(option.id)}
                />
              );
            })
          )}
        </div>
      </AxisRow>
      <AxisRow label={axes.effort.label}>
        {axes.effort.levels.length === 0 ? (
          <div
            role="group"
            aria-label={axes.effort.label}
            className="flex rounded-lg bg-background/40 p-1"
          >
            <PickerChip label="Not available" active={false} disabled onSelect={() => undefined} />
          </div>
        ) : (
          <EffortChips
            axis={axes.effort}
            value={effortValue}
            canEdit={canEditEffort}
            onPick={onEffort}
          />
        )}
      </AxisRow>
      {axes.toggles.length > 0 && (
        <AxisRow label={toggleRowLabel}>
          <div
            role="group"
            aria-label={toggleRowLabel}
            className="flex flex-wrap justify-center gap-1 rounded-lg bg-background/40 p-1"
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
