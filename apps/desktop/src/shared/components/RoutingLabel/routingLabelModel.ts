import type { EffortLevel, ProviderId } from '@goodboy/types';
import { getModelProvider, modelCatalogKey } from '@goodboy/core';
import { PROVIDER_BRAND } from '../../../features/providers/components/provider-brand';
import { EFFORT_LABEL, modelLabel } from '../../../features/chat/utils/chat-constants';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import {
  routingLabelParts,
  routingNameText,
  type RoutingTriggerLabel,
} from '../RoutingPicker/routingSummary';

export type PlannedRouting = {
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly effort?: string | null;
};

type Params = {
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: string | null;
  readonly planned: PlannedRouting | null;
  readonly isEffortObserved: boolean;
};

export type RoutingLabelModel = {
  readonly provider: ProviderId | null;
  readonly label: RoutingTriggerLabel | null;
  readonly tooltip: string;
  readonly isDiverged: boolean;
};

type RouteParams = {
  readonly provider: string | null;
  readonly model: string | null;
};

const knownProvider = ({ provider, model }: RouteParams): ProviderId | null => {
  const named = provider ?? (model != null ? getModelProvider(model) : null);
  return named != null && named in PROVIDER_BRAND ? (named as ProviderId) : null;
};

const providerName = (value: string | null): string | null =>
  value != null && value in PROVIDER_BRAND ? PROVIDER_LABEL[value as ProviderId] : value;

const effortLevel = (value: string | null | undefined): EffortLevel | null =>
  value != null && value in EFFORT_LABEL ? (value as EffortLevel) : null;

const comparableModel = ({ provider, model }: RouteParams): string | null => {
  if (model == null) {
    return null;
  }
  const resolved = knownProvider({ provider, model });
  if (resolved == null) {
    return model;
  }
  return modelCatalogKey({ provider: resolved, modelId: model }) ?? model;
};

type LabelParams = {
  readonly provider: ProviderId | null;
  readonly model: string;
  readonly effort: EffortLevel | null;
};

const labelOf = ({ provider, model, effort }: LabelParams): RoutingTriggerLabel => {
  if (provider != null) {
    return routingLabelParts({ provider, model, effort });
  }
  return { name: [modelLabel(model)], detail: effort != null ? [EFFORT_LABEL[effort]] : [] };
};

const sentenceOf = (label: RoutingTriggerLabel): string =>
  [routingNameText(label), ...label.detail].join(' ');

const EFFORT_WORDS: ReadonlySet<string> = new Set(Object.values(EFFORT_LABEL));

const effortSegment = (label: RoutingTriggerLabel): string | null =>
  label.detail.find((segment) => EFFORT_WORDS.has(segment)) ?? null;

type DivergenceParams = {
  readonly label: RoutingTriggerLabel;
  readonly ranProvider: string | null;
  readonly plannedProvider: string | null;
  readonly plannedRoute: RoutingTriggerLabel | null;
  readonly isProviderDiverged: boolean;
  readonly ranEffort: string | null;
  readonly plannedEffort: string | null;
};

const divergenceOf = ({
  label,
  ranProvider,
  plannedProvider,
  plannedRoute,
  isProviderDiverged,
  ranEffort,
  plannedEffort,
}: DivergenceParams): string | null => {
  if (plannedRoute != null) {
    return `Planned ${sentenceOf(plannedRoute)}, routing picked ${sentenceOf(label)}`;
  }
  if (isProviderDiverged) {
    return `Planned on ${providerName(plannedProvider)}, routing picked ${providerName(ranProvider)}`;
  }
  if (ranEffort != null && plannedEffort != null && plannedEffort !== ranEffort) {
    return `Planned ${plannedEffort}, ran ${ranEffort}`;
  }
  return null;
};

export const routingLabelModel = ({
  provider,
  model,
  effort,
  planned,
  isEffortObserved,
}: Params): RoutingLabelModel => {
  const resolved = knownProvider({ provider, model });
  if (model == null) {
    return { provider: resolved, label: null, tooltip: '', isDiverged: false };
  }
  const label = labelOf({ provider: resolved, model, effort: effortLevel(effort) });
  const ranProvider = provider ?? resolved;
  const plannedProvider = planned?.provider ?? null;
  const plannedModel = planned?.model ?? null;
  const ranKey = comparableModel({ provider, model });
  const plannedKey = comparableModel({ provider: plannedProvider, model: plannedModel });
  const isModelDiverged = plannedKey != null && ranKey != null && plannedKey !== ranKey;
  const isProviderDiverged =
    ranProvider != null && plannedProvider != null && plannedProvider !== ranProvider;
  const plannedEffortLevel = isEffortObserved ? effortLevel(planned?.effort) : null;
  const divergence = divergenceOf({
    label,
    ranProvider,
    plannedProvider,
    plannedRoute:
      isModelDiverged && plannedModel != null
        ? labelOf({
            provider: knownProvider({ provider: plannedProvider, model: plannedModel }),
            model: plannedModel,
            effort: effortLevel(planned?.effort),
          })
        : null,
    isProviderDiverged,
    ranEffort: effortSegment(label),
    plannedEffort:
      plannedEffortLevel == null
        ? null
        : effortSegment(labelOf({ provider: resolved, model, effort: plannedEffortLevel })),
  });
  const route = [
    ...(resolved != null ? [PROVIDER_LABEL[resolved]] : []),
    routingNameText(label),
    ...label.detail,
  ].join(' · ');
  return {
    provider: resolved,
    label,
    tooltip: divergence == null ? route : `${route}. ${divergence}`,
    isDiverged: divergence != null,
  };
};
