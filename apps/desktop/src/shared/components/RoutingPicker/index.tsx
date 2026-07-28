import { useEffect, useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import {
  MODEL_CATALOGS,
  PROVIDER_CAPABILITIES,
  modelIdForSelection,
  remapModelSelection,
  resolveModelArgs,
  resolveStoredModelSelection,
} from '@goodboy/core';
import { Button, Divider, Popover, ScrollFade, cn } from '@goodboy/ui';
import type { CatalogModel, ModelSelection, ProviderId } from '@goodboy/types';
import {
  EFFORT_LABEL,
  PROVIDER_LABEL,
  modelLabel,
  type EffortLevel,
} from '../../../features/chat/utils/chat-constants';
import {
  VERBOSITY_LABEL,
  VERBOSITY_LEVELS,
  type VerbosityLevel,
} from '../../../features/settings/verbosity';
import { useDropdown } from '../../hooks/useDropdown';
import { ModelGrid } from './ModelGrid';
import { PickerChip } from './PickerChip';
import { PickerSection } from './PickerSection';
import { ProviderGlyph } from './ProviderGlyph';
import { RecommendationRow } from './RecommendationRow';
import { TriggerLabel } from './TriggerLabel';
import { orderedEffortLevels } from './orderedEffortLevels';
import { recommendationSummary } from './recommendationSummary';
import { resolveRouting, type Recommendation } from './resolveRouting';

const CHIP_GROUP_CLASS_NAME = 'flex flex-wrap gap-1 bg-subtle px-2.5';
const PROVIDER_CHIP_GROUP_CLASS_NAME =
  'flex gap-1.5 bg-subtle px-2.5 [&>button]:h-7 [&>button]:flex-1';
const PROVIDERS = Object.keys(PROVIDER_CAPABILITIES).filter(
  (id): id is ProviderId => id in PROVIDER_CAPABILITIES,
);

type PickProviderParams = {
  readonly next: ProviderId | '';
  readonly viewedProvider: ProviderId;
};

type PickSelectionParams = {
  readonly next: ModelSelection;
  readonly provider: ProviderId;
};

type SelectionParams = {
  readonly model: CatalogModel;
  readonly effort: EffortLevel;
};

const selectionForModel = ({ model, effort }: SelectionParams): ModelSelection => {
  switch (model.provider) {
    case 'anthropic':
    case 'opencode':
    case 'openrouter':
      return { key: model.key, effort };
    case 'codex':
      return { key: model.key, effort, variant: model.variants[0]?.id };
    case 'cursor': {
      const combo =
        model.combos.find((candidate) => candidate.effort === effort) ?? model.combos[0];
      return {
        key: model.key,
        ...(combo?.effort != null && { effort: combo.effort }),
        toggles: {
          thinking: combo?.thinking ?? false,
          fast: combo?.fast ?? false,
        },
      };
    }
    case 'gemini':
      return { key: model.key };
    default: {
      const exhaustive: never = model;
      throw new Error(`unknown catalog model: ${String(exhaustive)}`);
    }
  }
};

type EffortSetting =
  | { readonly editable: false; readonly value?: EffortLevel }
  | {
      readonly editable: true;
      readonly value: EffortLevel;
      readonly onChange: (effort: EffortLevel) => void;
    };

export type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort: EffortSetting;
  readonly disabled: boolean;
  readonly onProvider: (provider: ProviderId | '') => void;
  readonly onModel: (model: string) => void;
  readonly recommendation?: Recommendation;
  readonly verbosity?: VerbosityLevel;
  readonly onVerbosity?: (verbosity: VerbosityLevel) => void;
  readonly onReset?: () => void;
  readonly overridden?: boolean;
  readonly defaultSummary?: string;
  readonly variant?: 'field' | 'pill';
  readonly align?: 'start' | 'end';
  readonly disabledTitle?: string;
  readonly ariaLabel?: string;
  readonly openEvent?: string;
};

export const RoutingPicker = ({
  connectedProviders,
  provider,
  model,
  effort,
  disabled,
  onProvider,
  onModel,
  recommendation,
  verbosity,
  onVerbosity,
  onReset,
  overridden,
  defaultSummary,
  variant = 'field',
  align = 'start',
  disabledTitle,
  ariaLabel,
  openEvent,
}: Props) => {
  const { open, close, toggle, containerRef, popupClassName } = useDropdown({
    disabled,
    align,
    openEvent,
    expectedHeight: 320,
    width: 'w-80 max-w-[calc(100vw-2rem)]',
  });
  const editableEffort = effort.editable ? effort : null;
  const effortValue = effort.value ?? 'medium';
  const recommendedProvider = recommendation?.provider;
  const recommendedModel = recommendation?.model;
  const routing = resolveRouting({
    providers: PROVIDERS,
    provider,
    model,
    effort: effortValue,
    recommendation,
  });
  const isOverridden = overridden === true;
  const isInheritingRecommendation =
    recommendedProvider != null && (routing.isProviderRecommended || overridden === false);
  const [viewProvider, setViewProvider] = useState(routing.provider);
  const [isViewingAuto, setIsViewingAuto] = useState(isInheritingRecommendation);
  const isViewingRoutingProvider = viewProvider === routing.provider;
  const storedRecommendedModel =
    recommendedModel != null
      ? resolveStoredModelSelection({ provider: viewProvider, id: recommendedModel })
      : null;
  const viewedRecommendedModel =
    isViewingRoutingProvider &&
    storedRecommendedModel != null &&
    storedRecommendedModel.report?.kind !== 'unknown'
      ? storedRecommendedModel.selection.key
      : undefined;
  const viewedRouting = resolveRouting({
    providers: PROVIDERS,
    provider: viewProvider,
    model: isViewingRoutingProvider ? model : '',
    effort: effortValue,
    recommendation: viewedRecommendedModel != null ? { model: viewedRecommendedModel } : undefined,
  });
  const gridRecommendedModel = recommendedProvider == null ? viewedRecommendedModel : undefined;
  const isViewProviderConnected = connectedProviders.includes(viewProvider);
  const showEffort = editableEffort != null && !routing.isEffortFixed;
  const isModelRecommended =
    isViewingRoutingProvider && routing.isModelRecommended && gridRecommendedModel != null;
  const summary = `${PROVIDER_LABEL[routing.provider]} · ${modelLabel(routing.model)}${
    showEffort ? ` · ${EFFORT_LABEL[routing.effort]}` : ''
  }${verbosity != null ? ` · ${VERBOSITY_LABEL[verbosity]}` : ''}`;

  useEffect(() => {
    if (open) {
      return;
    }
    setViewProvider(routing.provider);
    setIsViewingAuto(isInheritingRecommendation);
  }, [open, isInheritingRecommendation, routing.provider]);

  const onPickSelection = ({ next, provider: nextProvider }: PickSelectionParams) => {
    const resolved = resolveModelArgs({ provider: nextProvider, selection: next });
    onModel(modelIdForSelection({ provider: nextProvider, selection: next }));
    const applied = resolved.clamped?.applied ?? next.effort;
    if (editableEffort == null || applied == null || applied === editableEffort.value) {
      return;
    }
    editableEffort.onChange(applied);
  };

  const onPickProvider = ({ next, viewedProvider }: PickProviderParams) => {
    onProvider(next);
    setViewProvider(viewedProvider);
    setIsViewingAuto(next === '');
    if (next === '') {
      return;
    }
    const remapped = remapModelSelection({
      sourceProvider: routing.provider,
      targetProvider: next,
      selection: routing.selection,
    });
    onPickSelection({ next: remapped.selection, provider: next });
  };

  const onPickModel = (next: string) => {
    setIsViewingAuto(false);
    const nextModel = MODEL_CATALOGS[viewProvider].find((candidate) => candidate.key === next);
    if (nextModel == null) {
      return;
    }
    onPickSelection({
      next: selectionForModel({ model: nextModel, effort: viewedRouting.effort }),
      provider: viewProvider,
    });
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative flex items-center gap-1', variant === 'field' && 'w-full')}
    >
      {onReset != null && isOverridden && !disabled && (
        <button
          type="button"
          onClick={onReset}
          title={
            defaultSummary != null ? `reset to default (${defaultSummary})` : 'reset to default'
          }
          aria-label="reset routing override"
          className="shrink-0 rounded-full p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw size={10} aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        title={disabled ? (disabledTitle ?? summary) : `${summary}. Click to change.`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel != null ? `${ariaLabel}: ${summary}` : summary}
        className={cn(
          'items-center gap-1.5 text-xs transition-colors',
          variant === 'pill'
            ? 'inline-flex rounded-full px-2.5 py-0.5'
            : 'flex w-full rounded-md border px-2 py-1.5 text-left',
          variant === 'field' &&
            (open
              ? 'border-primary bg-primary/5'
              : 'border-border-soft bg-subtle hover:border-border hover:bg-muted/50'),
          variant === 'pill' &&
            (isOverridden
              ? 'bg-warning/10 ring-1 ring-warning/30 hover:bg-warning/15'
              : 'bg-subtle hover:bg-muted'),
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <TriggerLabel
            provider={routing.provider}
            model={routing.model}
            effort={routing.effort}
            showEffort={showEffort}
            verbosity={verbosity}
          />
        </span>
        <ChevronDown
          size={11}
          aria-hidden
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <Popover
          role="dialog"
          ariaLabel={ariaLabel ?? 'model routing'}
          className={cn(popupClassName, 'flex flex-col bg-subtle')}
        >
          {defaultSummary != null && (
            <div className="flex items-start gap-1.5 px-2.5 py-2 text-2xs leading-relaxed">
              <span
                className={cn('flex-1', isOverridden ? 'text-warning' : 'text-muted-foreground')}
              >
                {isOverridden ? 'Overriding default' : 'Using default'} ·{' '}
                {isOverridden ? summary : defaultSummary}
              </span>
              {onReset != null && isOverridden && (
                <button
                  type="button"
                  onClick={() => {
                    onReset();
                    close();
                  }}
                  className="font-medium text-warning underline-offset-2 hover:underline"
                >
                  reset
                </button>
              )}
            </div>
          )}
          {recommendedProvider != null && (
            <>
              <RecommendationRow
                summary={recommendationSummary({
                  provider: recommendedProvider,
                  model: recommendedModel,
                })}
                active={isViewingAuto}
                onSelect={() => onPickProvider({ next: '', viewedProvider: routing.provider })}
              />
              <Divider />
            </>
          )}
          <PickerSection label="Provider" hint="Which CLI agent runs the turn">
            <div className={PROVIDER_CHIP_GROUP_CLASS_NAME}>
              {PROVIDERS.map((id) => {
                const isConnected = connectedProviders.includes(id);
                const isActive = !isViewingAuto && viewProvider === id;
                const isRecommendedTab = isViewingAuto && recommendedProvider === id;
                return (
                  <button
                    key={id}
                    type="button"
                    title={PROVIDER_LABEL[id]}
                    aria-label={PROVIDER_LABEL[id]}
                    aria-pressed={isActive}
                    onClick={() => {
                      setViewProvider(id);
                      setIsViewingAuto(false);
                      if (!isConnected) {
                        return;
                      }
                      onPickProvider({ next: id, viewedProvider: id });
                    }}
                    className={cn(
                      'relative inline-flex min-w-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground',
                      isActive && 'bg-background text-foreground shadow-sm',
                      isRecommendedTab && 'text-foreground ring-1 ring-inset ring-border-soft',
                    )}
                  >
                    <span className={cn(!isConnected && 'opacity-35')}>
                      <ProviderGlyph id={id} size={15} />
                    </span>
                    {!isConnected && (
                      <span
                        className="absolute right-1 top-1 size-1.5 rounded-full bg-warning ring-1 ring-subtle"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </PickerSection>
          <Divider />
          <PickerSection label="Model" hint="Color shows the cost tier">
            {!isViewProviderConnected && (
              <div className="flex items-center gap-2 px-2.5 py-1">
                <p className="flex-1 text-xs text-muted-foreground">
                  {PROVIDER_LABEL[viewProvider]} is not connected
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('goodboy:open-provider-studio', {
                        detail: { providerId: viewProvider },
                      }),
                    );
                    close();
                  }}
                >
                  Connect {PROVIDER_LABEL[viewProvider]}
                </Button>
              </div>
            )}
            {isViewProviderConnected && (
              <ScrollFade fadeFrom="subtle" className="min-h-0 max-h-[15rem]">
                <ModelGrid
                  provider={viewProvider}
                  ids={viewedRouting.models}
                  value={viewedRouting.model}
                  selection={viewedRouting.selection}
                  recommendedModel={gridRecommendedModel}
                  isRecommended={isModelRecommended}
                  onSelect={onPickModel}
                  onSelection={(next) => onPickSelection({ next, provider: viewProvider })}
                />
              </ScrollFade>
            )}
          </PickerSection>
          {isViewProviderConnected && editableEffort != null && (
            <>
              <Divider />
              <PickerSection label="Effort" hint="How hard the model thinks before answering">
                {viewedRouting.isEffortFixed ? (
                  <div className={CHIP_GROUP_CLASS_NAME}>
                    <PickerChip label="Default" active disabled onSelect={() => undefined} />
                    {viewedRouting.hasThinkingToggle && (
                      <PickerChip
                        label="Thinking"
                        active={viewedRouting.selection.toggles?.thinking === true}
                        onSelect={() =>
                          onPickSelection({
                            next: {
                              ...viewedRouting.selection,
                              toggles: {
                                ...viewedRouting.selection.toggles,
                                thinking: viewedRouting.selection.toggles?.thinking !== true,
                              },
                            },
                            provider: viewProvider,
                          })
                        }
                      />
                    )}
                    {viewedRouting.hasFastToggle && (
                      <PickerChip
                        label="Fast"
                        active={viewedRouting.selection.toggles?.fast === true}
                        onSelect={() =>
                          onPickSelection({
                            next: {
                              ...viewedRouting.selection,
                              toggles: {
                                ...viewedRouting.selection.toggles,
                                fast: viewedRouting.selection.toggles?.fast !== true,
                              },
                            },
                            provider: viewProvider,
                          })
                        }
                      />
                    )}
                  </div>
                ) : (
                  <div className={CHIP_GROUP_CLASS_NAME}>
                    {orderedEffortLevels({ levels: viewedRouting.effortLevels }).map((level) => (
                      <PickerChip
                        key={level}
                        label={EFFORT_LABEL[level]}
                        active={viewedRouting.effort === level}
                        onSelect={() =>
                          onPickSelection({
                            next: { ...viewedRouting.selection, effort: level },
                            provider: viewProvider,
                          })
                        }
                      />
                    ))}
                    {viewedRouting.hasThinkingToggle && (
                      <PickerChip
                        label="Thinking"
                        active={viewedRouting.selection.toggles?.thinking === true}
                        onSelect={() =>
                          onPickSelection({
                            next: {
                              ...viewedRouting.selection,
                              toggles: {
                                ...viewedRouting.selection.toggles,
                                thinking: viewedRouting.selection.toggles?.thinking !== true,
                              },
                            },
                            provider: viewProvider,
                          })
                        }
                      />
                    )}
                    {viewedRouting.hasFastToggle && (
                      <PickerChip
                        label="Fast"
                        active={viewedRouting.selection.toggles?.fast === true}
                        onSelect={() =>
                          onPickSelection({
                            next: {
                              ...viewedRouting.selection,
                              toggles: {
                                ...viewedRouting.selection.toggles,
                                fast: viewedRouting.selection.toggles?.fast !== true,
                              },
                            },
                            provider: viewProvider,
                          })
                        }
                      />
                    )}
                    {viewedRouting.clamped != null && (
                      <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-1 text-2xs text-warning">
                        {EFFORT_LABEL[viewedRouting.clamped.requested]} to{' '}
                        {EFFORT_LABEL[viewedRouting.clamped.applied]}
                      </span>
                    )}
                  </div>
                )}
              </PickerSection>
            </>
          )}
          {isViewProviderConnected && verbosity != null && onVerbosity != null && (
            <>
              <Divider />
              <PickerSection label="Replies" hint="How detailed the answers should be">
                <div className={CHIP_GROUP_CLASS_NAME}>
                  {VERBOSITY_LEVELS.map((level) => (
                    <PickerChip
                      key={level}
                      label={VERBOSITY_LABEL[level]}
                      active={verbosity === level}
                      onSelect={() => onVerbosity(level)}
                    />
                  ))}
                </div>
              </PickerSection>
            </>
          )}
        </Popover>
      )}
    </div>
  );
};
