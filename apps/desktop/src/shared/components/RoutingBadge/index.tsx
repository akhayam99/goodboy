import { Tooltip, WORK_META_COLUMN, cn } from '@goodboy/ui';
import type { ProviderId, EffortLevel } from '@goodboy/types';
import { getModelProvider, modelCatalogKey, clampEffortForModel } from '@goodboy/core';
import { PROVIDER_BRAND, brandColor } from '../../../features/providers/components/provider-brand';
import { EFFORT_LABEL, modelLabel } from '../../../features/chat/utils/chat-constants';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { EffortNote } from './EffortNote';

type PlannedRouting = {
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly effort?: string | null;
};

type Props = {
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly effort?: string | null;
  readonly planned?: PlannedRouting | null;
  readonly isEffortObserved?: boolean;
  readonly variant?: 'compact' | 'full' | 'bare';
  readonly glyphPlacement?: 'leading' | 'trailing';
  readonly muted?: boolean;
  readonly className?: string;
};

const providerDisplayLabel = (value: string | null): string | null =>
  value != null && value in PROVIDER_BRAND ? PROVIDER_LABEL[value as ProviderId] : value;

type ProviderKeyParams = {
  readonly provider: string | null;
  readonly model: string | null;
};

const knownProvider = ({ provider, model }: ProviderKeyParams): ProviderId | null => {
  const named = provider ?? (model != null ? getModelProvider(model) : null);
  return named != null && named in PROVIDER_BRAND ? (named as ProviderId) : null;
};

const comparableModel = ({ provider, model }: ProviderKeyParams): string | null => {
  if (model == null) {
    return null;
  }
  const resolved = knownProvider({ provider, model });
  if (resolved == null) {
    return model;
  }
  return modelCatalogKey({ provider: resolved, modelId: model }) ?? model;
};

type DivergenceCopyParams = {
  readonly isModelDiverged: boolean;
  readonly plannedModel: string | null;
  readonly ranModel: string | null;
  readonly plannedProviderLabel: string | null;
  readonly ranProviderLabel: string | null;
};

const divergenceCopy = ({
  isModelDiverged,
  plannedModel,
  ranModel,
  plannedProviderLabel,
  ranProviderLabel,
}: DivergenceCopyParams): string | null => {
  if (isModelDiverged && plannedModel != null && ranModel != null) {
    return `Planned ${modelLabel(plannedModel)}, routing picked ${modelLabel(ranModel)} instead`;
  }
  if (plannedProviderLabel != null && ranProviderLabel != null) {
    return `Planned on ${plannedProviderLabel}, routing picked ${ranProviderLabel} instead`;
  }
  return null;
};

type ShownEffortParams = {
  readonly model: string | null;
  readonly effort: string | null;
};

const shownEffort = ({ model, effort }: ShownEffortParams): EffortLevel | null => {
  const level = effort != null && effort in EFFORT_LABEL ? (effort as EffortLevel) : null;
  if (model == null || level == null) {
    return level;
  }
  return clampEffortForModel({ model, effort: level }) ?? level;
};

const MISSING_LABEL = 'Model not chosen yet';

const CHIP_CLASS =
  'inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground';

export const RoutingBadge = ({
  provider = null,
  model = null,
  effort = null,
  planned = null,
  isEffortObserved = false,
  variant = 'compact',
  glyphPlacement = 'leading',
  muted = false,
  className,
}: Props) => {
  const named = provider ?? (model != null ? getModelProvider(model) : null);
  const resolvedProvider = named != null && named in PROVIDER_BRAND ? (named as ProviderId) : null;
  const providerLabel = resolvedProvider != null ? PROVIDER_LABEL[resolvedProvider] : named;
  const Glyph = resolvedProvider != null ? PROVIDER_BRAND[resolvedProvider].icon : null;
  const resolvedEffort = shownEffort({ model, effort });
  const plannedEffort = isEffortObserved
    ? shownEffort({ model: planned?.model ?? model, effort: planned?.effort ?? null })
    : null;
  const effortDivergence =
    resolvedEffort != null && plannedEffort != null && plannedEffort !== resolvedEffort
      ? `Planned ${EFFORT_LABEL[plannedEffort]}, ran ${EFFORT_LABEL[resolvedEffort]}`
      : null;
  const glyphSize = variant === 'compact' ? 11 : 12;
  const plannedModel = planned?.model ?? null;
  const plannedProvider = planned?.provider ?? null;
  const ranModelKey = comparableModel({ provider, model });
  const plannedModelKey = comparableModel({ provider: plannedProvider, model: plannedModel });
  const isModelDiverged =
    ranModelKey != null && plannedModelKey != null && plannedModelKey !== ranModelKey;
  const isProviderDiverged = named != null && plannedProvider != null && plannedProvider !== named;
  const isDiverged = model != null && (isModelDiverged || isProviderDiverged);
  const plannedShortLabel =
    isModelDiverged && plannedModel != null
      ? modelLabel(plannedModel)
      : (providerDisplayLabel(plannedProvider) ??
        (plannedModel != null ? modelLabel(plannedModel) : null));
  const divergenceTooltip = isDiverged
    ? divergenceCopy({
        isModelDiverged,
        plannedModel,
        ranModel: model,
        plannedProviderLabel: providerDisplayLabel(plannedProvider),
        ranProviderLabel: providerLabel,
      })
    : null;
  const divergenceNote =
    isDiverged && plannedShortLabel != null && divergenceTooltip != null ? (
      <Tooltip content={divergenceTooltip}>
        <span
          data-testid="routing-divergence"
          className="min-w-0 truncate text-faint-foreground line-through"
        >
          {plannedShortLabel}
        </span>
      </Tooltip>
    ) : null;

  const glyph =
    Glyph != null && resolvedProvider != null ? (
      <Glyph
        size={glyphSize}
        className="shrink-0"
        style={{ color: brandColor(resolvedProvider) }}
        aria-hidden
      />
    ) : null;

  if (variant === 'bare') {
    if (model == null) {
      return (
        <>
          <span aria-hidden className={cn(WORK_META_COLUMN.model, className)} />
          <span aria-hidden className={WORK_META_COLUMN.effort} />
        </>
      );
    }
    const effortLabel = resolvedEffort != null ? EFFORT_LABEL[resolvedEffort] : null;
    const routingText = [
      modelLabel(model),
      effortLabel,
      providerLabel != null ? `on ${providerLabel}` : null,
    ]
      .filter((part) => part != null)
      .join(' ');
    const routingTooltip = [routingText, divergenceTooltip, effortDivergence]
      .filter((part) => part != null)
      .join('. ');
    const effortCell = (
      <span
        data-meta-column="effort"
        data-testid={effortDivergence != null ? 'effort-divergence' : undefined}
        className={cn(
          WORK_META_COLUMN.effort,
          !isEffortObserved && 'text-faint-foreground',
          effortDivergence != null && 'underline decoration-dotted underline-offset-2',
        )}
      >
        {effortLabel}
      </span>
    );
    return (
      <>
        <Tooltip content={routingTooltip}>
          <span data-meta-column="model" className={cn(WORK_META_COLUMN.model, className)}>
            {glyph}
            <span
              data-testid={isDiverged ? 'routing-divergence' : undefined}
              className={cn(
                WORK_META_COLUMN.modelLabel,
                isDiverged && 'underline decoration-dotted underline-offset-2',
              )}
            >
              {modelLabel(model)}
            </span>
          </span>
        </Tooltip>
        {effortDivergence != null ? (
          <Tooltip content={effortDivergence}>{effortCell}</Tooltip>
        ) : (
          effortCell
        )}
      </>
    );
  }

  if (variant === 'full') {
    return (
      <span className={cn('flex flex-wrap items-center gap-1.5', muted && 'opacity-60', className)}>
        <span className={CHIP_CLASS}>
          {Glyph != null && resolvedProvider != null && (
            <Glyph
              size={glyphSize}
              className="shrink-0"
              style={{ color: brandColor(resolvedProvider) }}
              aria-hidden
            />
          )}
          {providerLabel ?? MISSING_LABEL}
        </span>
        {model != null && (
          <span className={cn(CHIP_CLASS, 'min-w-0 font-mono')} title={model}>
            <span className="truncate">{modelLabel(model)}</span>
          </span>
        )}
        {resolvedEffort != null && (
          <span className={CHIP_CLASS}>{EFFORT_LABEL[resolvedEffort]}</span>
        )}
        {divergenceNote != null && <span className={CHIP_CLASS}>{divergenceNote}</span>}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1 text-2xs',
        muted && 'opacity-60',
        className,
      )}
    >
      {glyphPlacement === 'leading' ? glyph : null}
      {model != null ? (
        <span
          className="min-w-0 truncate font-mono font-medium text-foreground"
          title={`Model: ${model}`}
        >
          {modelLabel(model)}
        </span>
      ) : (
        <span className="text-faint-foreground">{MISSING_LABEL}</span>
      )}
      {model != null && resolvedEffort != null && (
        <EffortNote label={EFFORT_LABEL[resolvedEffort]} divergence={effortDivergence} />
      )}
      {divergenceNote}
      {glyphPlacement === 'trailing' ? glyph : null}
    </span>
  );
};
