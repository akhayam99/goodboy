import { useEffect, useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import {
  MODEL_CATALOGS,
  modelAxes,
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
import { DropdownPortal } from '../../hooks/useDropdown/DropdownPortal';
import { useDropdown } from '../../hooks/useDropdown';
import { AxesSection } from './AxesSection';
import { verbosityTone } from './chipTone';
import { CatalogGrid } from './CatalogGrid';
import { PickerChip } from './PickerChip';
import { PickerSection } from './PickerSection';
import { ProviderGrid } from './ProviderGrid';
import { RecommendationRow } from './RecommendationRow';
import { TriggerLabel } from './TriggerLabel';
import { ROUTING_PICKER_CONSTANTS } from './constants';
import { recommendationSummary } from './recommendationSummary';
import { resolvePickerSelection } from './resolvePickerSelection';
import { resolveRouting, type Recommendation } from './resolveRouting';
import { selectionForModel } from './selectionForModel';
import { useCursorMaxModeModels } from './useCursorMaxModeModels';
import { ProviderInlineConnect } from '../../../features/providers/components/ProviderInlineConnect';

const CHIP_GROUP_CLASS_NAME = 'flex flex-wrap gap-1 bg-subtle px-2.5';

type PickProviderParams = {
  readonly next: ProviderId | '';
  readonly viewedProvider: ProviderId;
};

type PickSelectionParams = {
  readonly next: ModelSelection;
  readonly provider: ProviderId;
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
  const [isProviderConnectionInFlight, setIsProviderConnectionInFlight] = useState(false);
  const {
    open,
    close,
    toggle,
    containerRef,
    popupRef,
    popupClassName,
    popupStyle,
    portal,
    portalTarget,
  } = useDropdown({
    disabled,
    align,
    openEvent,
    expectedHeight: 320,
    expectedWidth: 384,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
    strategy: 'fixed',
    isEscapeEnabled: isProviderConnectionInFlight === false,
  });
  const editableEffort = effort.editable ? effort : null;
  const effortValue = effort.value ?? 'medium';
  const recommendedProvider = recommendation?.provider;
  const recommendedModel = recommendation?.model;
  const routing = resolveRouting({
    providers: ROUTING_PICKER_CONSTANTS.providers,
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
  const [draftSelection, setDraftSelection] = useState<ModelSelection>(routing.selection);
  const [clampNotice, setClampNotice] = useState(routing.clamped);
  const [connectProvider, setConnectProvider] = useState<ProviderId | null>(null);
  const viewedRecommendedStored =
    recommendedProvider == null && recommendedModel != null
      ? resolveStoredModelSelection({ provider: viewProvider, id: recommendedModel })
      : null;
  const viewedRecommendedSelection =
    viewedRecommendedStored?.report?.kind === 'unknown'
      ? null
      : (viewedRecommendedStored?.selection ?? null);
  const draftModelId = modelIdForSelection({
    provider: viewProvider,
    selection: draftSelection,
  });
  const viewedRouting = resolveRouting({
    providers: ROUTING_PICKER_CONSTANTS.providers,
    provider: viewProvider,
    model: draftModelId,
    effort: draftSelection.effort ?? effortValue,
  });
  const isViewProviderConnected = connectedProviders.includes(viewProvider);
  const showEffort = !routing.isEffortFixed;
  const routingModel = MODEL_CATALOGS[routing.provider].find(
    (candidate) => candidate.key === routing.model,
  );
  const routingVariant =
    routingModel?.provider === 'codex' && routingModel.variants.length > 1
      ? routingModel.variants.find((candidate) => candidate.id === routing.selection.variant)
      : null;
  const summaryModel = `${modelLabel(routing.model)}${
    routingVariant != null ? ` ${routingVariant.label}` : ''
  }`;
  const summary = `${PROVIDER_LABEL[routing.provider]} · ${summaryModel}${
    showEffort ? ` · ${EFFORT_LABEL[routing.effort]}` : ''
  }${verbosity != null ? ` · ${VERBOSITY_LABEL[verbosity]}` : ''}`;
  const viewedModel =
    viewedRouting.catalog.find((candidate) => candidate.key === viewedRouting.model) ??
    viewedRouting.catalog[0];
  if (viewedModel == null) {
    throw new Error(`provider catalog is empty: ${viewProvider}`);
  }
  const viewedResolved = resolveModelArgs({
    provider: viewProvider,
    selection: viewedRouting.selection,
  });
  const axes = modelAxes({ model: viewedModel, selection: viewedRouting.selection });
  const cursorModels = MODEL_CATALOGS.cursor.map((entry) => entry.key);
  const maxModeModels = useCursorMaxModeModels({ models: cursorModels });
  const advisoryKeys =
    viewProvider === 'cursor' ? maxModeModels : ROUTING_PICKER_CONSTANTS.emptyModelKeys;
  const hasMaxModeAdvisory = viewProvider === 'cursor' && maxModeModels.has(viewedModel.key);

  useEffect(() => {
    if (open) {
      return;
    }
    setViewProvider(routing.provider);
    setIsViewingAuto(isInheritingRecommendation);
    setDraftSelection(routing.selection);
    setClampNotice(routing.clamped);
    setConnectProvider(null);
  }, [
    open,
    isInheritingRecommendation,
    routing.provider,
    routing.model,
    routing.effort,
    model,
    provider,
  ]);

  useEffect(() => {
    if (open === false || isViewProviderConnected === false) {
      return;
    }
    popupRef.current
      ?.querySelector<HTMLButtonElement>('section[aria-label="Models"] button[aria-pressed="true"]')
      ?.focus();
  }, [isViewProviderConnected, open, popupRef]);

  const onPickSelection = ({ next, provider: nextProvider }: PickSelectionParams) => {
    const resolved = resolvePickerSelection({
      provider: nextProvider,
      selection: next,
    });
    const nextModelId = modelIdForSelection({ provider: nextProvider, selection: next });
    const applied = resolved.effort;
    const normalized = resolveStoredModelSelection({
      provider: nextProvider,
      id: nextModelId,
      ...(applied != null && { effort: applied }),
    }).selection;
    const appliedSelection =
      nextProvider === 'gemini' && next.effort != null
        ? { ...normalized, effort: next.effort }
        : normalized;
    setDraftSelection(appliedSelection);
    setClampNotice(resolved.notice);
    onModel(nextModelId);
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
      setDraftSelection(routing.selection);
      return;
    }
    const remapped = remapModelSelection({
      sourceProvider: viewProvider,
      targetProvider: next,
      selection: viewedRouting.selection,
    });
    const nextSelection =
      next === 'gemini'
        ? { ...remapped.selection, effort: viewedRouting.effort }
        : remapped.selection;
    onPickSelection({ next: nextSelection, provider: next });
    setClampNotice(remapped.record.clamped);
  };

  const onPickModel = (nextModel: CatalogModel) => {
    setIsViewingAuto(false);
    const next = selectionForModel({ model: nextModel, effort: viewedRouting.effort });
    onPickSelection({ next, provider: viewProvider });
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
            modelDetail={routingVariant?.label}
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
      <DropdownPortal portal={portal} portalTarget={portalTarget}>
        {open && (
          <Popover
            innerRef={popupRef}
            role="dialog"
            ariaLabel={ariaLabel ?? 'model routing'}
            className={cn(popupClassName, 'flex max-h-[calc(100vh-1rem)] flex-col bg-subtle')}
            style={popupStyle}
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
              <ProviderGrid
                connectedProviders={connectedProviders}
                activeProvider={isViewingAuto ? null : viewProvider}
                secondaryProvider={isViewingAuto ? (recommendedProvider ?? null) : null}
                onSelect={(id) => {
                  const isConnected = connectedProviders.includes(id);
                  setViewProvider(id);
                  setIsViewingAuto(false);
                  setConnectProvider(null);
                  if (!isConnected) {
                    const preview = remapModelSelection({
                      sourceProvider: viewProvider,
                      targetProvider: id,
                      selection: viewedRouting.selection,
                    });
                    setDraftSelection(
                      id === 'gemini'
                        ? { ...preview.selection, effort: viewedRouting.effort }
                        : preview.selection,
                    );
                    return;
                  }
                  onPickProvider({ next: id, viewedProvider: id });
                }}
              />
            </PickerSection>
            <Divider />
            {connectProvider != null ? (
              <section aria-label="Connect provider" className="min-h-0">
                <ProviderInlineConnect
                  providerId={connectProvider}
                  onDone={() => setConnectProvider(null)}
                  onInFlightChange={setIsProviderConnectionInFlight}
                />
              </section>
            ) : null}
            {!isViewProviderConnected && connectProvider == null && (
              <section aria-label="Models" className="flex items-center gap-2 p-3">
                <p className="flex-1 text-xs text-muted-foreground">
                  {PROVIDER_LABEL[viewProvider]} is not connected
                </p>
                <Button size="sm" onClick={() => setConnectProvider(viewProvider)}>
                  Connect {PROVIDER_LABEL[viewProvider]}
                </Button>
              </section>
            )}
            {isViewProviderConnected && connectProvider == null && (
              <ScrollFade fadeFrom="subtle" className="min-h-0 max-h-[15rem]">
                <CatalogGrid
                  catalog={viewedRouting.catalog}
                  selectedKey={viewedRouting.model}
                  recommendedKey={viewedRecommendedSelection?.key}
                  advisoryKeys={advisoryKeys}
                  onSelect={onPickModel}
                />
              </ScrollFade>
            )}
            {isViewProviderConnected && connectProvider == null && (
              <>
                <Divider />
                <AxesSection
                  axes={axes}
                  effortValue={viewedRouting.effort}
                  canEditEffort={editableEffort != null}
                  notice={clampNotice}
                  hasMaxModeAdvisory={hasMaxModeAdvisory}
                  onEffort={(level) =>
                    onPickSelection({
                      next: { ...viewedRouting.selection, effort: level },
                      provider: viewProvider,
                    })
                  }
                  onVariant={(id) =>
                    onPickSelection({
                      next: { ...viewedRouting.selection, variant: id },
                      provider: viewProvider,
                    })
                  }
                  onToggle={(id) =>
                    onPickSelection({
                      next: {
                        ...viewedRouting.selection,
                        toggles: {
                          ...viewedRouting.selection.toggles,
                          [id]: !(viewedRouting.selection.toggles?.[id] ?? false),
                        },
                      },
                      provider: viewProvider,
                    })
                  }
                />
              </>
            )}
            {isViewProviderConnected &&
              connectProvider == null &&
              verbosity != null &&
              onVerbosity != null && (
                <>
                  <Divider />
                  <PickerSection label="Replies" hint="How detailed the answers should be">
                    <div className={CHIP_GROUP_CLASS_NAME}>
                      {VERBOSITY_LEVELS.map((level) => (
                        <PickerChip
                          key={level}
                          label={VERBOSITY_LABEL[level]}
                          active={verbosity === level}
                          tone={verbosityTone(level)}
                          onSelect={() => onVerbosity(level)}
                        />
                      ))}
                    </div>
                  </PickerSection>
                </>
              )}
            <Divider />
            <footer className="px-3 py-2 font-mono text-2xs text-muted-foreground">
              {viewedResolved.args.join(' ')}
            </footer>
          </Popover>
        )}
      </DropdownPortal>
    </div>
  );
};
