import type { ProviderId, RoleModelPreferences } from '@goodboy/types';
import { getDefaultTurnModel } from '@goodboy/core';
import { clampEffort, type EffortLevel } from '../../../../chat/utils/chat-constants';
import { kindRouting } from '../../../../session/agent-kind';

export { clampEffort };

export type CardConfig = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel;
};

type DefaultParams = {
  readonly roleModels: RoleModelPreferences | null;
};

export const defaultConfig = ({ roleModels }: DefaultParams): CardConfig => {
  const routing = kindRouting({ kind: 'resolver', roleModels });
  return { provider: routing.provider, model: routing.model, effort: routing.effort };
};

type ConfigForParams = {
  readonly provider: ProviderId;
  readonly base: CardConfig;
};

export const configFor = ({ provider, base }: ConfigForParams): CardConfig => {
  const model = provider === base.provider ? base.model : getDefaultTurnModel({ id: provider });
  return { provider, model, effort: clampEffort(model, base.effort) };
};

export const sameConfig = (a: CardConfig, b: CardConfig): boolean => {
  return a.provider === b.provider && a.model === b.model && a.effort === b.effort;
};

type AggregateParams = {
  readonly configs: ReadonlyArray<CardConfig>;
  readonly fallback: CardConfig;
};

export const aggregateConfig = ({ configs, fallback }: AggregateParams): CardConfig | 'mixed' => {
  const first = configs[0];
  if (first == null) {
    return fallback;
  }
  return configs.every((c) => sameConfig(c, first)) ? first : 'mixed';
};
