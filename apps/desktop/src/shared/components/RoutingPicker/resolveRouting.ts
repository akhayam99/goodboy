import type { ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES, getDefaultTurnModel, getModelProvider } from '@goodboy/core';
import {
  clampEffort,
  modelEffortLevels,
  type EffortLevel,
} from '../../../features/chat/utils/chat-constants';

type Params = {
  readonly providers: ReadonlyArray<ProviderId>;
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort: EffortLevel;
  readonly recommendedProvider?: ProviderId;
  readonly recommendedModel?: string;
};

export type ResolvedRouting = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel;
  readonly effortLevels: ReadonlyArray<EffortLevel> | null;
  readonly models: ReadonlyArray<string>;
  readonly isProviderRecommended: boolean;
  readonly isModelRecommended: boolean;
};

export const resolveRouting = ({
  providers,
  provider,
  model,
  effort,
  recommendedProvider,
  recommendedModel,
}: Params): ResolvedRouting => {
  const resolvedProvider =
    provider !== ''
      ? provider
      : (recommendedProvider ?? getModelProvider(model) ?? providers[0] ?? 'anthropic');
  const resolvedModel =
    model !== '' ? model : (recommendedModel ?? getDefaultTurnModel(resolvedProvider));
  const ids = PROVIDER_CAPABILITIES[resolvedProvider].models.map((entry) => entry.id);
  return {
    provider: resolvedProvider,
    model: resolvedModel,
    effort: clampEffort(resolvedModel, effort),
    effortLevels: modelEffortLevels(resolvedModel),
    models: ids.includes(resolvedModel) ? ids : [...ids, resolvedModel],
    isProviderRecommended: provider === '',
    isModelRecommended: model === '',
  };
};
