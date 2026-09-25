import { useEffect, useState, type RefObject } from 'react';
import {
  MODEL_CATALOGS,
  isApiProvider,
  modelAxes,
  modelIdForSelection,
  remapModelSelection,
  resolveStoredModelSelection,
  visibleCatalog,
} from '@goodboy/core';
import { Button, cn, Divider } from '@goodboy/ui';
import type {
  CatalogModel,
  EffortLevel,
  ModelSelection,
  ProviderId,
  VerbosityLevel,
} from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { VERBOSITY_LABEL, VERBOSITY_LEVELS } from '../../../features/settings/verbosity';
import { useCliGate } from '../../../features/providers/hooks/useCliGate';
import { useHiddenModels } from '../../../features/providers/hooks/useHiddenModels';
import { ModelVisibilityLink } from './ModelVisibilityLink';
import { ProviderInlineConnect } from '../../../features/providers/components/ProviderInlineConnect';
import { AxesSection } from './AxesSection';
import { verbosityTone } from './chipTone';
import { PickerChip } from './PickerChip';
import { PickerSection } from './PickerSection';
import { ProviderGrid } from './ProviderGrid';
import { RecommendationRow, type RecommendationKind } from './RecommendationRow';
import { NoConnectedProviders } from './NoConnectedProviders';
import { ROUTING_PICKER_CONSTANTS } from './constants';
import { recommendationSummary, recommendedRoutingOf } from './recommendationSummary';
import { resolvePickerSelection } from './resolvePickerSelection';
import { resolveRouting, type Recommendation } from './resolveRouting';
import { selectionForModel } from './selectionForModel';
import { useCursorMaxModeModels } from './useCursorMaxModeModels';

const CHIP_GROUP_CLASS_NAME = 'flex flex-wrap gap-1 bg-subtle px-2.5';

type PickProviderParams = {
  readonly next: ProviderId | '';
  readonly viewedProvider: ProviderId;
};

type PickSelectionParams = {
  readonly next: ModelSelection;
  readonly provider: ProviderId;
};

export type LastUsedRouting = {
  readonly routing: Recommendation;
  readonly active: boolean;
  readonly onSelect: () => void;
};

export type EffortSetting =
  | { readonly editable: false; readonly value?: EffortLevel }
  | {
      readonly editable: true;
      readonly value: EffortLevel;
      readonly onChange: (effort: EffortLevel) => void;
    };

type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort: EffortSetting;
  readonly onProvider: (provider: ProviderId | '') => void;
  readonly onModel: (model: string) => void;
  readonly onClose: () => void;
  readonly recommendation?: Recommendation;
  readonly recommendationKind?: RecommendationKind;
  readonly lastUsed?: LastUsedRouting;
  readonly verbosity?: VerbosityLevel;
  readonly onVerbosity?: (verbosity: VerbosityLevel) => void;
  readonly onReset?: () => void;
  readonly overridden?: boolean;
  readonly defaultSummary?: string;
  readonly summary?: string;
  readonly availability?: 'run' | 'setup';
  readonly isInline?: boolean;
  readonly focusRoot?: RefObject<HTMLElement | null>;
  readonly onConnectionInFlightChange?: (isInFlight: boolean) => void;
};

export const RoutingPickerBody = ({
  connectedProviders,
  provider,
  model,
  effort,
  onProvider,
  onModel,
  onClose,
  recommendation,
  recommendationKind,
  lastUsed,
  verbosity,
  onVerbosity,
  onReset,
  overridden,
  defaultSummary,
  summary,
  availability = 'run',
  isInline = true,
  focusRoot,
  onConnectionInFlightChange,
}: Props) => {
  const separator = isInline ? null : <Divider />;
  const editableEffort = effort.editable ? effort : null;
  const effortValue = effort.value ?? 'medium';
  const recommendedProvider = recommendation?.provider;
  const recommendedModel = recommendation?.model;
  const recommendedEffort = recommendation?.effort;
  const recommendedReason = recommendation?.reason;
  const recommendedLabel = recommendation?.label;
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
  const viewedModel =
    viewedRouting.catalog.find((candidate) => candidate.key === viewedRouting.model) ??
    viewedRouting.catalog[0];
  if (viewedModel == null) {
    throw new Error(`provider catalog is empty: ${viewProvider}`);
  }
  const hiddenModels = useHiddenModels();
  const hiddenKeys = new Set(hiddenModels[viewProvider] ?? []);
  const shownCatalog = visibleCatalog({
    provider: viewProvider,
    hidden: hiddenModels,
    currentKey: viewedModel.key,
  });
  const axes = modelAxes({
    model: viewedModel,
    selection: viewedRouting.selection,
    catalog: shownCatalog,
  });
  const cursorModels = MODEL_CATALOGS.cursor.map((entry) => entry.key);
  const maxModeModels = useCursorMaxModeModels({ models: cursorModels });
  const hasMaxModeAdvisory = viewProvider === 'cursor' && maxModeModels.has(viewedModel.key);
  const viewedCliGate = useCliGate({ provider: viewProvider, modelId: viewedModel.key });

  useEffect(() => {
    if (!isInline) {
      return;
    }
    setViewProvider(routing.provider);
    setIsViewingAuto(isInheritingRecommendation);
    setDraftSelection(routing.selection);
    setClampNotice((current) => routing.clamped ?? current);
    setConnectProvider(null);
  }, [
    isInline,
    isInheritingRecommendation,
    routing.provider,
    routing.model,
    routing.effort,
    model,
    provider,
  ]);

  useEffect(() => {
    if (focusRoot == null || isViewProviderConnected === false) {
      return;
    }
    focusRoot.current
      ?.querySelector<HTMLButtonElement>(
        '[role="group"][aria-label="Model"] button[aria-pressed="true"]',
      )
      ?.focus();
  }, [focusRoot, isViewProviderConnected]);

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
    <>
      {defaultSummary != null && (
        <div className="flex items-start gap-1.5 px-2.5 py-2 text-2xs leading-relaxed">
          <span className={cn('flex-1', isOverridden ? 'text-warning' : 'text-muted-foreground')}>
            {isOverridden ? 'Overriding default' : 'Using default'} ·{' '}
            {isOverridden ? (summary ?? defaultSummary) : defaultSummary}
          </span>
          {onReset != null && isOverridden && (
            <button
              type="button"
              onClick={() => {
                onReset();
                onClose();
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
            routing={recommendedRoutingOf({
              provider: recommendedProvider,
              model: recommendedModel,
              effort: recommendedEffort,
            })}
            summary={recommendationSummary({
              provider: recommendedProvider,
              model: recommendedModel,
              effort: recommendedEffort,
            })}
            active={isViewingAuto}
            {...(recommendationKind != null && { kind: recommendationKind })}
            {...(recommendedReason != null && { reason: recommendedReason })}
            {...(recommendedLabel != null && { label: recommendedLabel })}
            onSelect={() => onPickProvider({ next: '', viewedProvider: routing.provider })}
          />
          {lastUsed?.routing.provider != null && (
            <RecommendationRow
              label="Last used here"
              routing={recommendedRoutingOf({
                provider: lastUsed.routing.provider,
                model: lastUsed.routing.model,
                effort: lastUsed.routing.effort,
              })}
              summary={recommendationSummary({
                provider: lastUsed.routing.provider,
                model: lastUsed.routing.model,
                effort: lastUsed.routing.effort,
              })}
              active={lastUsed.active}
              onSelect={lastUsed.onSelect}
            />
          )}
          {separator}
        </>
      )}
      <PickerSection
        label="Provider"
        {...(!isApiProvider({ id: viewProvider }) && {
          action: <ModelVisibilityLink provider={viewProvider} onNavigate={onClose} />,
        })}
      >
        {connectedProviders.length === 0 && availability === 'run' ? (
          <NoConnectedProviders onNavigate={onClose} />
        ) : (
          <ProviderGrid
            connectedProviders={connectedProviders}
            activeProvider={isViewingAuto ? null : viewProvider}
            secondaryProvider={isViewingAuto ? (recommendedProvider ?? null) : null}
            showDisconnected={availability === 'setup'}
            onNavigateProviders={onClose}
            onSelect={(id) => {
              const isConnected = connectedProviders.includes(id);
              setViewProvider(id);
              setIsViewingAuto(false);
              setConnectProvider(null);
              if (isConnected === false) {
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
        )}
      </PickerSection>
      {separator}
      {connectProvider != null ? (
        <section aria-label="Connect provider" className="min-h-0">
          <ProviderInlineConnect
            providerId={connectProvider}
            onDone={() => setConnectProvider(null)}
            onInFlightChange={(isInFlight) => onConnectionInFlightChange?.(isInFlight)}
          />
        </section>
      ) : null}
      {connectedProviders.length > 0 && !isViewProviderConnected && connectProvider == null && (
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
        <>
          {separator}
          <AxesSection
            axes={axes}
            effortValue={viewedRouting.effort}
            canEditEffort={editableEffort != null}
            notice={clampNotice}
            hasMaxModeAdvisory={hasMaxModeAdvisory}
            cliGate={viewedCliGate}
            hiddenKeys={hiddenKeys}
            onModel={(modelKey) => {
              const nextModel = viewedRouting.catalog.find(
                (candidate) => candidate.key === modelKey,
              );
              if (nextModel == null) {
                return;
              }
              onPickModel(nextModel);
            }}
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
            {separator}
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
    </>
  );
};
