import type { EffortLevel, ProviderId } from '@goodboy/types';
import { resolveStoredModelSelection } from '@goodboy/core';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { routingLabelParts, routingSummary, type RoutingTriggerLabel } from './routingSummary';

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
  return { provider, label: routingLabelParts({ provider, model, effort: effort ?? null }) };
};

export const recommendationSummary = (params: Params): string => {
  const { provider, label } = recommendedRoutingOf(params);
  return label === null ? PROVIDER_LABEL[provider] : routingSummary({ provider, label });
};
