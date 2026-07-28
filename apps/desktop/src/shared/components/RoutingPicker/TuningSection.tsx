import type { CatalogModel, EffortLevel, ModelSelection, ProviderId } from '@goodboy/types';
import { EFFORT_LABEL } from '../../../features/chat/utils/chat-constants';
import { PickerChip } from './PickerChip';
import { TuningRow } from './TuningRow';

const CURSOR_EFFORTS = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] satisfies ReadonlyArray<EffortLevel>;

type Props = {
  readonly provider: ProviderId;
  readonly model: CatalogModel;
  readonly selection: ModelSelection;
  readonly effort: EffortLevel;
  readonly effortLevels: ReadonlyArray<EffortLevel>;
  readonly canEditEffort: boolean;
  readonly notice?: {
    readonly requested: EffortLevel;
    readonly applied: EffortLevel;
  };
  readonly onSelection: (selection: ModelSelection) => void;
};

type ToggleParams = {
  readonly model: Extract<CatalogModel, { provider: 'cursor' }>;
  readonly selection: ModelSelection;
  readonly toggle: 'thinking' | 'fast';
  readonly value: boolean;
};

const hasToggleCombination = ({ model, selection, toggle, value }: ToggleParams): boolean => {
  const thinking = toggle === 'thinking' ? value : (selection.toggles?.thinking ?? false);
  const fast = toggle === 'fast' ? value : (selection.toggles?.fast ?? false);
  return model.combos.some((combo) => combo.thinking === thinking && combo.fast === fast);
};

type CursorEffortsParams = {
  readonly model: Extract<CatalogModel, { provider: 'cursor' }>;
  readonly selection: ModelSelection;
};

const cursorEfforts = ({ model, selection }: CursorEffortsParams): ReadonlySet<EffortLevel> => {
  const thinking = selection.toggles?.thinking ?? false;
  const fast = selection.toggles?.fast ?? false;
  return new Set(
    model.combos
      .filter((combo) => combo.thinking === thinking && combo.fast === fast)
      .map((combo) => combo.effort)
      .filter((level) => level != null),
  );
};

export const TuningSection = ({
  provider,
  model,
  selection,
  effort,
  effortLevels,
  canEditEffort,
  notice,
  onSelection,
}: Props) => {
  if (provider === 'gemini') {
    return (
      <section aria-label="Tuning" className="p-3">
        <p className="text-xs text-muted-foreground">No tuning options for this provider</p>
      </section>
    );
  }

  const cursorModel = model.provider === 'cursor' ? model : null;
  const availableCursorEfforts =
    cursorModel == null ? new Set<EffortLevel>() : cursorEfforts({ model: cursorModel, selection });
  const renderedEfforts = cursorModel == null ? effortLevels : CURSOR_EFFORTS;
  const thinkingActive = selection.toggles?.thinking === true;
  const fastActive = selection.toggles?.fast === true;
  const canToggleThinking =
    cursorModel != null &&
    hasToggleCombination({
      model: cursorModel,
      selection,
      toggle: 'thinking',
      value: !thinkingActive,
    });
  const canToggleFast =
    cursorModel != null &&
    hasToggleCombination({
      model: cursorModel,
      selection,
      toggle: 'fast',
      value: !fastActive,
    });

  return (
    <section aria-label="Tuning" className="flex flex-col gap-2.5 p-3">
      {model.provider === 'codex' && model.variants.length > 1 && (
        <TuningRow label="Variant">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-background/40 p-1">
            {model.variants.map((variant) => (
              <PickerChip
                key={variant.id}
                label={variant.label}
                active={(selection.variant ?? model.variants[0]?.id) === variant.id}
                onSelect={() => onSelection({ ...selection, variant: variant.id })}
              />
            ))}
          </div>
        </TuningRow>
      )}
      <TuningRow
        label={provider === 'opencode' || provider === 'openrouter' ? 'Variant' : 'Effort'}
      >
        <div
          role="group"
          aria-label={provider === 'opencode' || provider === 'openrouter' ? 'Variant' : 'Effort'}
          className="grid grid-flow-col auto-cols-fr gap-1 rounded-lg bg-background/40 p-1"
        >
          {renderedEfforts.map((level) => {
            const isUnavailable =
              canEditEffort === false ||
              (cursorModel != null && availableCursorEfforts.has(level) === false);
            const explanation =
              cursorModel != null && availableCursorEfforts.has(level) === false
                ? `${EFFORT_LABEL[level]} is unavailable for ${model.label} with Thinking ${
                    thinkingActive ? 'on' : 'off'
                  } and Fast ${fastActive ? 'on' : 'off'}`
                : canEditEffort === false
                  ? 'Tuning is fixed in this context'
                  : undefined;
            return (
              <PickerChip
                key={level}
                label={EFFORT_LABEL[level]}
                active={effort === level}
                disabled={isUnavailable}
                title={explanation}
                onSelect={() => onSelection({ ...selection, effort: level })}
              />
            );
          })}
        </div>
      </TuningRow>
      {cursorModel != null && (
        <>
          <TuningRow label="Thinking">
            <PickerChip
              label="Thinking"
              active={thinkingActive}
              disabled={canToggleThinking === false}
              title={
                canToggleThinking
                  ? undefined
                  : `Thinking cannot be changed for ${model.label} with Fast ${
                      fastActive ? 'on' : 'off'
                    }`
              }
              onSelect={() =>
                onSelection({
                  ...selection,
                  toggles: { ...selection.toggles, thinking: !thinkingActive },
                })
              }
            />
          </TuningRow>
          <TuningRow label="Fast">
            <PickerChip
              label="Fast"
              active={fastActive}
              disabled={canToggleFast === false}
              title={
                canToggleFast
                  ? undefined
                  : `Fast cannot be changed for ${model.label} with Thinking ${
                      thinkingActive ? 'on' : 'off'
                    }`
              }
              onSelect={() =>
                onSelection({
                  ...selection,
                  toggles: { ...selection.toggles, fast: !fastActive },
                })
              }
            />
          </TuningRow>
        </>
      )}
      {notice != null && (
        <p role="status" className="text-2xs text-warning">
          Effort adjusted from {EFFORT_LABEL[notice.requested]} to {EFFORT_LABEL[notice.applied]}.
        </p>
      )}
    </section>
  );
};
