import type { EffortLevel, ProviderId } from '@goodboy/types';
import { resolveStoredModelSelection } from '@goodboy/core';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { ROUTING_PICKER_CONSTANTS } from './constants';
import { resolveRouting } from './resolveRouting';
import { routingSummary, routingTriggerLabel, type RoutingTriggerLabel } from './routingSummary';

type Params = {
  readonly provider: ProviderId;
  readonly model?: string;
  readonly effort?: EffortLevel | null;
};

export type RecommendedRouting = {
  readonly provider: ProviderId;
  readonly label: RoutingTriggerLabel | null;
};

export const recommendedRoutingOf = ({ provider, model, effort }: Params): RecommendedRouting => {
  const providerOnly = { provider, label: null };
  if (model == null) {
    return providerOnly;
  }
  if (resolveStoredModelSelection({ provider, id: model }).report?.kind === 'unknown') {
    return providerOnly;
  }
  const routing = resolveRouting({
    providers: ROUTING_PICKER_CONSTANTS.providers,
    provider,
    model,
    effort: effort ?? 'medium',
  });
  const label = routingTriggerLabel({
    model: routing.catalog.find((candidate) => candidate.key === routing.model) ?? null,
    modelId: routing.model,
    selection: routing.selection,
    effort: routing.effort,
    showEffort: effort != null && !routing.isEffortFixed,
  });
  return { provider: routing.provider, label };
};

export const recommendationSummary = (params: Params): string => {
  const { provider, label } = recommendedRoutingOf(params);
  return label === null ? PROVIDER_LABEL[provider] : routingSummary({ provider, label });
};
