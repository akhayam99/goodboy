import { Tooltip, cn } from '@goodboy/ui';
import type { ProviderId, EffortLevel } from '@goodboy/types';
import { getModelProvider, modelCatalogKey } from '@goodboy/core';
import { PROVIDER_BRAND, brandColor } from '../../../features/providers/components/provider-brand';
import {
  EFFORT_LABEL,
  PROVIDER_LABEL,
  clampEffort,
  modelLabel,
} from '../../../features/chat/utils/chat-constants';

type PlannedRouting = {
  readonly provider?: string | null;
  readonly model?: string | null;
};

type Props = {
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly effort?: string | null;
  readonly planned?: PlannedRouting | null;
  readonly variant?: 'compact' | 'full';
  readonly glyphPlacement?: 'leading' | 'trailing';
  readonly missingLabel?: string;
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

const CHIP_CLASS =
  'inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground';

export const RoutingBadge = ({
  provider = null,
  model = null,
  effort = null,
  planned = null,
  variant = 'compact',
  glyphPlacement = 'leading',
  missingLabel = 'not resolved',
  muted = false,
  className,
}: Props) => {
  const named = provider ?? (model != null ? getModelProvider(model) : null);
  const resolvedProvider = named != null && named in PROVIDER_BRAND ? (named as ProviderId) : null;
  const providerLabel = resolvedProvider != null ? PROVIDER_LABEL[resolvedProvider] : named;
  const Glyph = resolvedProvider != null ? PROVIDER_BRAND[resolvedProvider].icon : null;
  const level = effort != null && effort in EFFORT_LABEL ? (effort as EffortLevel) : null;
  const resolvedEffort = model != null && level != null ? clampEffort(model, level) : level;
  const glyphSize = variant === 'full' ? 12 : 11;
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
          {providerLabel ?? missingLabel}
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

  const glyph =
    Glyph != null && resolvedProvider != null ? (
      <Glyph
        size={glyphSize}
        className="shrink-0"
        style={{ color: brandColor(resolvedProvider) }}
        aria-hidden
      />
    ) : null;

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
        <span className="text-faint-foreground">{missingLabel}</span>
      )}
      {model != null && resolvedEffort != null && (
        <span className="shrink-0 text-muted-foreground" title="Effort">
          {EFFORT_LABEL[resolvedEffort]}
        </span>
      )}
      {divergenceNote}
      {glyphPlacement === 'trailing' ? glyph : null}
    </span>
  );
};
