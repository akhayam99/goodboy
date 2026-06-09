import type { ProviderId } from '@goodboy/types';
import { getDefaultTurnModel } from '@goodboy/core';
import { clampEffort, type EffortLevel } from '../../../../chat/utils/chat-constants';
import { AGENT_KIND_DEFAULTS } from '../../../../session/agent-kind';

export { clampEffort };

export type CardConfig = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel;
};

export const DEFAULT_CONFIG: CardConfig = {
  provider: 'anthropic',
  model: AGENT_KIND_DEFAULTS.resolver.model,
  effort: AGENT_KIND_DEFAULTS.resolver.effort,
};

export const configFor = (provider: ProviderId): CardConfig => {
  const model = provider === 'anthropic' ? DEFAULT_CONFIG.model : getDefaultTurnModel(provider);
  return { provider, model, effort: clampEffort(model, DEFAULT_CONFIG.effort) };
};

export const sameConfig = (a: CardConfig, b: CardConfig): boolean => {
  return a.provider === b.provider && a.model === b.model && a.effort === b.effort;
};

export const aggregateConfig = (configs: ReadonlyArray<CardConfig>): CardConfig | 'mixed' => {
  const first = configs[0];
  if (!first) {
    return DEFAULT_CONFIG;
  }
  return configs.every((c) => sameConfig(c, first)) ? first : 'mixed';
};
