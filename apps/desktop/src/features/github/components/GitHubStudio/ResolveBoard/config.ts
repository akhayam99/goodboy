import type { ProviderId } from '@goodboy/types';
import { getDefaultTurnModel } from '@goodboy/core';
import { modelEffortLevels, type EffortLevel } from '../../../../chat/utils/chat-constants';
import { AGENT_KIND_DEFAULTS } from '../../../../session/agent-kind';

export interface CardConfig {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel;
}

export const DEFAULT_CONFIG: CardConfig = {
  provider: 'anthropic',
  model: AGENT_KIND_DEFAULTS.resolver.model,
  effort: AGENT_KIND_DEFAULTS.resolver.effort,
};

export function clampEffort(model: string, effort: EffortLevel): EffortLevel {
  const levels = modelEffortLevels(model);
  if (!levels) return effort;
  return levels.includes(effort) ? effort : (levels[levels.length - 1] ?? effort);
}

export function configFor(provider: ProviderId): CardConfig {
  const model = provider === 'anthropic' ? DEFAULT_CONFIG.model : getDefaultTurnModel(provider);
  return { provider, model, effort: clampEffort(model, DEFAULT_CONFIG.effort) };
}

export function sameConfig(a: CardConfig, b: CardConfig): boolean {
  return a.provider === b.provider && a.model === b.model && a.effort === b.effort;
}

export function aggregateConfig(configs: ReadonlyArray<CardConfig>): CardConfig | 'mixed' {
  const first = configs[0];
  if (!first) return DEFAULT_CONFIG;
  return configs.every((c) => sameConfig(c, first)) ? first : 'mixed';
}
