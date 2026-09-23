import type { EffortLevel, ProviderId } from '@goodboy/types';
import { resolveStoredModelSelection } from '@goodboy/core';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { ROUTING_PICKER_CONSTANTS } from './constants';
import { resolveRouting } from './resolveRouting';
import { routingSummary, routingTriggerLabel } from './routingSummary';

type Params = {
  readonly provider: ProviderId;
  readonly model?: string;
  readonly effort?: EffortLevel | null;
};

export const recommendationSummary = ({ provider, model, effort }: Params): string => {
  if (model == null) {
    return PROVIDER_LABEL[provider];
  }
  if (resolveStoredModelSelection({ provider, id: model }).report?.kind === 'unknown') {
    return PROVIDER_LABEL[provider];
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
  return routingSummary({ provider: routing.provider, label });
};
