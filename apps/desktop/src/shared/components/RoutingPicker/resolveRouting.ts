import type { ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES, getDefaultTurnModel, getModelProvider } from '@goodboy/core';
import {
  clampEffort,
  modelEffortLevels,
  type EffortLevel,
} from '../../../features/chat/utils/chat-constants';

export type Recommendation = {
  readonly provider?: ProviderId;
  readonly model?: string;
};

type Params = {
  readonly providers: ReadonlyArray<ProviderId>;
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort: EffortLevel;
  readonly recommendation?: Recommendation;
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
  recommendation,
}: Params): ResolvedRouting => {
  const resolvedProvider =
    provider !== ''
      ? provider
      : (recommendation?.provider ?? getModelProvider(model) ?? providers[0] ?? 'anthropic');
  const resolvedModel =
    model !== '' ? model : (recommendation?.model ?? getDefaultTurnModel(resolvedProvider));
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
